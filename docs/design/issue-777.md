# 設計書: ゲスト（未認証）ユーザーも vote できるようにする (#777)

## 目的

ログイン前のユーザーも vote できるようにし、プロダクトへの参加感を早期に得られるようにする。
ゲストの vote はスコアに反映され、コミュニティ選定の重みに影響する（ADR-0030）。

## 背景と既存設計の変更点

現在の vote は認証必須（`requireAuth` ミドルウェア）で、`Vote.userId` が必須 FK。
ページビュー計測（PageView / ADR-0032）が `sessionId` で dedup するのと同じ戦略を vote に適用する。

ADR-0031（Vote Exclusive Arc）の `userId` 必須前提を変更: `userId` を nullable にし、代わりに
`sessionId: String`（必須）を dedup キーとする。

## 受け入れ条件とアプローチ

| # | 受け入れ条件 | 実装箇所 |
|---|------------|---------|
| 1 | 未認証でも vote POST が 200 を返す | `requireAuth` を削除 |
| 2 | リクエストボディに `sessionId` 必須 | `VoteRequestSchema` に追加 |
| 3 | `@@unique([sessionId, postId/commentId])` で重複防止 | スキーマ変更 |
| 4 | `localStorage` に `"hatchery:guestId"` で永続化 | `client/src/api/votes.ts` |
| 5 | ログイン済みは `sessionId = userId` | クライアント実装 |
| 6 | `requireAuth` 削除 + レート制限追加（60req/min） | `posts.ts` |
| 7 | `Vote.userId` nullable + `Vote.sessionId` 追加 + バックフィル | Prisma スキーマ + マイグレーション |
| 8 | `VoteRepository` シグネチャ更新 | ポート + 実装 |
| 9 | `useGuestVoteGuard` 削除 | クライアント削除 |
| 10 | `LoginPromptSnackbar` 削除（vote 専用のため） | クライアント削除 |
| 11 | `pnpm turbo run build test lint` 緑 | ビルド確認 |

## 変更ファイル一覧

### common
- `common/src/domain/post/post.ts`: `VoteRequestSchema` に `sessionId: z.string().uuid().max(36)` 追加

### server
- `server/prisma/schema.prisma`: `Vote.userId` nullable / `Vote.sessionId` 追加 / ユニーク制約変更
- `server/prisma/migrations/...`: 既存レコードのバックフィル + NOT NULL 化
- `server/src/persistence/voteRepository.ts`: `userId: string | null`, `sessionId: string` に変更
- `server/src/persistence/prismaVoteRepository.ts`: sessionId dedup に変更
- `server/src/routes/posts.ts`: `requireAuth` 削除 + レート制限追加
- `server/src/openapi/registrations/registerPosts.ts`: 401 削除 + 説明更新

### client
- `client/src/api/votes.ts`: `getOrCreateGuestId()` 追加 / `sessionId` をリクエストに含める
- `client/src/hooks/useGuestVoteGuard.ts`: 削除
- `client/src/hooks/useGuestVoteGuard.test.tsx`: 削除
- `client/src/components/LoginPromptSnackbar.tsx`: 削除
- `client/src/components/LoginPromptSnackbar.test.tsx`: 削除
- `client/src/routes/HomeFeedScene.tsx`: `guardVote` 除去
- `client/src/routes/PostThreadScene.tsx`: `guardVote` 除去
- `client/src/routes/CommunityScene.tsx`: `guardVote` 除去
- `client/src/mocks/handlers.ts`: vote ハンドラ更新

### docs
- `docs/adr/0036-guest-vote-session-id.md`: 新規 ADR（ADR-0031 の userId 必須前提を変更）
- `docs/adr/README.md`: ADR 一覧に追加

### e2e
- `e2e/home-feed/usecases.md`: UC-HOME-08 を「ゲストも vote できる」に変更

## sessionId の決定ロジック（クライアント）

sessionId =
  ログイン済み → userId（useAuth から）
  ゲスト → localStorage["hatchery:guestId"]（なければ UUID 生成・永続化）

これにより:
- 同一ゲストが同一投稿に再 vote するとトグル/スイッチが機能する
- ログイン済みの vote 動作（toggle/switch・スコア反映）は変わらない

## DB スキーマ変更

Vote モデル変更:
- sessionId: String（追加・必須・dedup キー）
- userId: String?（nullable に変更・認証済みのみセット）
- ユニーク制約: @@unique([sessionId, postId]) / @@unique([sessionId, commentId])

バックフィル SQL:
  ALTER TABLE "Vote" ADD COLUMN "sessionId" TEXT;
  UPDATE "Vote" SET "sessionId" = "userId" WHERE "sessionId" IS NULL;
  ALTER TABLE "Vote" ALTER COLUMN "sessionId" SET NOT NULL;

## レート制限

vote エンドポイントに専用レート制限を追加:
- windowMs: 60_000（1分）
- max: 60（60回/分）
- ルーター全体ではなく各 vote エンドポイントに個別適用
