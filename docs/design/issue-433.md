# 設計書: Issue #433 管理者が任意の worker 名義で post / comment を作成できる API

## 背景・目的

定時バッチ（`server/src/batch/runCommunityBatch.ts`）以外に post / comment を作成する手段がない。
運用上、管理者が手動でコミュニティの会話を補ったり、デモ・検証用コンテンツを投入できるようにしたい。

ADR-0020 により post / comment の author は **workerId のみ**（人間ユーザーは投稿しない）。
この制約を維持し、管理者は「既存 worker を author として選択して代理投稿する」形にする。
これは admin 専用の運用機能であり、concept.md の「ユーザーの関与は up vote と購読のみ」制約には反しない。

スコープは **API 基盤のみ**（client UI は後続 Issue）。

## 受け入れ条件 → 入出力

### AC1: `CreatePostRequestSchema`（common）

`common/src/domain/post/post.ts` に追加する。

| フィールド | 型 | 制約 |
|------------|------|------|
| `communityId` | string | `.uuid()` |
| `authorWorkerId` | string | `.uuid()` |
| `title` | string | `.min(1).max(POST_TITLE_MAX_LENGTH)` |
| `text` | string | `.min(1).max(POST_TEXT_MAX_LENGTH)` |

すべての文字列フィールドに `.max()` を付ける（#91）。`communityId` / `authorWorkerId` は `.uuid()` で形式と上限を同時に担保する。

### AC2: `CreateCommentRequestSchema`（common）

`common/src/domain/comment/comment.ts` に追加する。

| フィールド | 型 | 制約 |
|------------|------|------|
| `postId` | string | `.uuid()` |
| `authorWorkerId` | string | `.uuid()` |
| `text` | string | `.min(1).max(COMMENT_TEXT_MAX_LENGTH)` |

### AC3: `POST /api/admin/posts`

- `requireAuth` + `requireAdmin`（既存の `createAdminRouter` 内 `router.use(requireAuth, requireAdmin)` で全体保護済み）。
- ボディを `CreatePostRequestSchema` で検証（`validateBody`）。
- `communityId` が存在しない → 404（`NotFoundError("CommunityNotFound")`）。
- `authorWorkerId` が存在しない / 削除済み → 404（`NotFoundError("WorkerNotFound")`）。
  - `workerRepository.findById` は論理削除済みワーカーを `null` で返すため、削除済みも 404 になる。
- 成功時 **201** で作成された Post（`PostRecord`）を返す。

### AC4: `POST /api/admin/comments`

- 同様に `requireAuth` + `requireAdmin`、`CreateCommentRequestSchema` で検証。
- `postId` から post を解決し、その post の `communityId` を comment に紐づける。
- `postId` が存在しない → 404（`NotFoundError("PostNotFound")`）。
- `authorWorkerId` が存在しない / 削除済み → 404（`NotFoundError("WorkerNotFound")`）。
- 成功時 **201** で作成された Comment（`CommentRecord`）を返す。

### AC5: slotKey 採番（複合ユニーク制約と衝突しない）

post / comment は Prisma の複合ユニーク制約 `(communityId, slotKey, seq)` で永続化される。
定時バッチの slotKey は `"YYYY-MM-DDTHH:MM"` 形式（`generateSlotKey`）。

手動作成は **`slotKey = "manual:<uuid>"`・`seq = 0`** で採番する。

- `manual:` プレフィックスにより定時バッチの slotKey と決して衝突しない。
- 作成ごとに新しい UUID を振るため、手動作成同士でも衝突しない（`seq` は常に 0 で十分）。
- 既存の `PostRepository.createMany` / `CommentRepository.createMany`（`(communityId, slotKey, seq)` upsert）をそのまま 1 件入力で再利用する。

manual slotKey を組み立てる純粋関数 `buildManualSlotKey(uuid)` を common
（`common/src/domain/post/post.ts`）に置き、`MANUAL_SLOT_KEY_PREFIX` 定数とともにエクスポートする
（UI/DB 不要で TDD 可能・ドメインロジックは common に置く方針）。

作成された post / comment は既存のフィード取得 API（`GET /api/communities/{slug}/feed`・`GET /api/feed`・
`GET /api/posts/{postId}`）に通常の post / comment として表示される（slotKey に依存しない取得のため）。

### AC6: 認可

- member ロール（非 admin）→ 403（`requireAdmin`）。
- 未認証 → 401（`requireAuth`）。
- 両エンドポイントについてテストを書く。

### AC7: OpenAPI 登録（ADR-0006）

`server/src/openapi/registry.ts` に以下を登録する。

- `CreatePostRequest` / `CreateCommentRequest` コンポーネント（common の Zod から）。
- `POST /api/admin/posts`・`POST /api/admin/comments` のパス（201 / 400 / 401 / 403 / 404）。

`pnpm --filter @hatchery/server openapi` で `server/openapi.json` に反映される（生成物はコミットしない）。

### AC8: TDD・ビルド緑・import 境界

`pnpm turbo run build test lint` が緑。client → common / server → common の一方向 import を守る
（common には Express/Prisma を持ち込まない。`buildManualSlotKey` は純粋関数のみ）。

## 設計判断

1. **新ルートを既存 `createAdminRouter` に追加する**（別ルータを増やさない）。
   `createAdminRouter` のシグネチャに `postRepository` / `commentRepository` を追加し、`app.ts` の
   配線を更新する。既存の admin 作成系（workers / communities）と同じ場所にまとまり一貫する。

2. **レスポンスは camelCase の `PostRecord` / `CommentRecord` をそのまま返す**。
   既存の `GET /api/posts/{postId}`・`GET /api/feed` も `PostRecord` を素のまま JSON 化して返しており、
   それに揃える（OpenAPI 上の Post/Comment スキーマは snake_case だが、これは既存実装の既知の差異であり
   本 Issue で是正対象としない。OpenAPI レスポンスは既存の `Post` / `Comment` コンポーネントを流用する）。

3. **author には `authorWorkerId`（worker の id）を格納する**。
   定時バッチも `post.author` に検証済み workerId を入れており、`author` フィールドの実体は workerId。
   フィードのワーカー解決（`recent-workers` 等）が `post.author` を id として `workerRepo.listByIds` で
   引いているため、id を入れることで既存の表示と整合する。

4. **存在チェックの順序**: community/post → worker の順で検証し、最初に欠けたものに対応する 404 を返す。

## テスト

- common: `CreatePostRequestSchema` / `CreateCommentRequestSchema` の境界（必須・uuid・max 超過・min）、
  `buildManualSlotKey` がプレフィックス付きの文字列を返すこと。
- server route: `POST /api/admin/posts`・`POST /api/admin/comments` について
  201（成功・author=workerId・feed に出る）/ 400（バリデーション）/ 401 / 403 /
  404（community/post なし・worker なし・削除済み worker）。

## スコープ外

- client の作成 UI（別 Issue）。
- post / comment の編集・削除 API。
- 管理者自身が author になる機能（ADR-0020 変更が必要なため対象外）。
- OpenAPI レスポンスの snake_case / camelCase 差異の是正（既存実装に合わせるのみ）。
</content>
</invoke>
