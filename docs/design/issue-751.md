# 設計書: 投稿（Post）を全文検索できるページを追加する (#751)

## 1. 目的 / 背景

ホームフィード・コミュニティフィードをスクロールするしかなかったコンテンツ探索を改善する。
`/search?q=` ページをキーワード検索で Post 一覧を返す形で追加し、AppHeader の検索アイコンから常時アクセスできるようにする。

## 2. スコープ（やること / やらないこと）

**やること**
- `common` に `SearchQuerySchema`（Zod `.max(200)` 必須）を追加
- `server` に `GET /api/posts/search?q=` エンドポイントを追加（ILIKE 部分一致・最大 50 件・新着順）
- `server` の OpenAPI registry に登録（`pnpm --filter @hatchery/server openapi` で再生成）
- `client` に `fetchSearchPosts` / `useSearchPosts` を追加（openApiClient + 生成型利用）
- `client` に `/search` ルートと `SearchScene.tsx` を追加（`q` を URL search param で保持）
- `AppHeader` に検索アイコンボタンを常時配置

**やらないこと**
- コミュニティ・ワーカー・コメント横断検索
- 無限スクロール・ページネーション（最大 50 件固定）
- スペル揺れサジェスト・全文検索エンジン（pg_trgm 等）
- インライン検索結果表示（ページ遷移で可）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `common/src/domain/search/search.ts` に `SearchQuerySchema = z.object({ q: z.string().min(1).max(200) })` が存在する
2. `GET /api/posts/search?q=キーワード` がヒット件数 ≤ 50 の Post 配列を新着順で返す
3. `GET /api/posts/search` で q 未指定・空文字は 400 を返す
4. 検索クエリは `contains: q, mode: 'insensitive'` で SQL インジェクション非発生
5. client の `fetchSearchPosts(q)` が `/api/posts/search` を openApiClient 経由で呼ぶ
6. `/search?q=xxx` でヒット結果を PostCard で表示、0 件は「"xxx" に一致する投稿は見つかりませんでした」
7. `/search`（q 空）は「キーワードを入力してください」を表示
8. AppHeader に検索アイコンボタンが常時存在し、押下で `/search` へ遷移する
9. `pnpm turbo run build test lint` が緑

## 4. 設計方針

### API 設計
- 既存の `posts.ts` ルートに `GET /api/posts/search` ハンドラを追加する
- `PostRepository` に `search(q: string): Promise<PostRecord[]>` を追加
- `prismaPostRepository` では `findMany({ where: { OR: [{ title: { contains: q, mode: 'insensitive' } }, { text: { contains: q, mode: 'insensitive' } }] }, orderBy: { createdAt: 'desc' }, take: 50 })` で実装
- reveal フィルタ（`createdAt <= now`）を適用する

### common
- `common/src/domain/search/search.ts` 新設
- `common/src/domain/index.ts` に re-export 追加（または `domain/search/` への直接 import）

### client API
- `client/src/api/search.ts` 新設（`fetchSearchPosts` / `useSearchPosts`）
- TanStack Query キー: `["posts", "search", q]`

### SearchScene
- `q` を URL search param で保持（TanStack Router の `validateSearch`）
- 入力欄 + Enter/ボタンで `/search?q=xxx` へ遷移
- 結果は PostCard で一覧表示（`HomeFeedScene` パターン踏襲）

### AppHeader
- 既存アイコンボタン（ハンバーガー）のスタイルに倣い `SearchRounded` アイコンボタンを追加
- `useNavigate` で `/search` へ遷移

## 5. 影響範囲 / 既存への変更

- `common/`: 新規ファイル追加のみ
- `server/`: `postRepository.ts`（interface 追加）、`prismaPostRepository.ts`（実装追加）、`posts.ts`（ハンドラ追加）、`registrations/registerPosts.ts`（OpenAPI 登録追加）
- `client/`: `api/search.ts`（新規）、`routes/SearchScene.tsx`（新規）、`router.tsx`（ルート追加）、`AppHeader.tsx`（アイコンボタン追加）

## 6. テスト計画（TDD で書くテスト一覧）

### common
- `SearchQuerySchema` の最小境界（min 1: 空文字は invalid）
- `SearchQuerySchema` の最大境界（max 200: 201 文字は invalid）
- 正常ケース（1〜200 文字は valid）

### server（integration: `describe.skipIf(!DATABASE_URL)`）
- `search()` でタイトル一致する投稿が返る
- `search()` で本文一致する投稿が返る
- `search()` は最大 50 件を返す（51 件用意してもオーバーしない）
- `search()` は新着順で返る
- `search()` は reveal フィルタを通す（未来の createdAt は除外）
- API: `GET /api/posts/search?q=xxx` が 200 と PostItem 配列を返す
- API: `q` 未指定で 400 を返す

### client
- `useSearchPosts('xxx')` が `/api/posts/search?q=xxx` を呼ぶ
- `SearchScene`: q=あり でヒット結果の PostCard が表示される
- `SearchScene`: q=あり で 0 件のとき「〜に一致する投稿は見つかりませんでした」
- `SearchScene`: q=なし で「キーワードを入力してください」
- `AppHeader`: 検索アイコンが表示される

## 7. リスク・未決事項

- OpenAPI `openapi.gen.ts` は生成物なのでコミットしない（`.gitignore` 済み）
- `q` の SQL インジェクションは Prisma `contains` + `mode: 'insensitive'` でプリペアドステートメントが自動適用されるため安全
