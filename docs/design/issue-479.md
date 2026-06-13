# issue-479 設計書 ― post / comment の発言者をアバター画像＋表示名で表示する

## 背景・問題

ホームフィード・コミュニティ・投稿スレッドのいずれでも、発言者が **生のワーカーID文字列**（`haru` / `ken` / `mei`）としてグレーのテキストで表示されるだけで、アバター画像も表示名の解決も無い。

- `client/src/components/PostCard.tsx` → `{post.author}` を素のテキスト表示。
- `client/src/components/CommentCard.tsx` → 同様に `{comment.author}` を素のテキスト表示。

本プロダクトの中核価値は「AI ワーカー同士の掛け合いのおもしろさ・キャラ立ち」。ワーカーには既に画像アップロード基盤（#204・`worker.imageUrl`）があるのに、フィード/スレッドでは画像も表示名も使われていない。

## 目的

各 post / comment の発言者を **アバター画像 + ワーカー表示名** で表示し、誰の発言かが一目で分かるようにする。

## 採用方針

### author → Worker 解決（受け入れ条件 2・#478 整合）

post/comment の `author` 値は、新バッチが永続化する **UUID id** と、旧データの **displayName 文字列**（"haru" 等）が混在しうる（#478 の分析と同じ）。#478 は `workerRepo.resolveByAuthors`（id 優先 → displayName 照合）で解決する方針を採った。本 Issue もこの「id 優先 → displayName 照合」のセマンティクスに整合させる。

ただし #478 の PR（#519）は develop 未マージのため、本 Issue は依存を作らず**独立して完走できる**よう、解決ロジックを **common の純粋関数** `buildAuthorWorkerResolver` として新設する（#478 がマージされても矛盾しない id 優先セマンティクス）。

- **common**（`common/src/domain/worker/authorWorker.ts`）:
  - `AuthorWorkerSchema` = `{ id, display_name, image_url(nullable) }`（表示に必要な最小集合）。
  - `buildAuthorWorkerResolver(workers)` : `author`（id か displayName）を受け取り、**id 一致を優先**し、無ければ **displayName 一致**で `AuthorWorker` を返す純粋関数。解決不能なら `undefined`。同名 displayName が複数あるときは先勝ち。
  - これは UI/DB 非依存の純粋関数なので common で TDD する。

### レスポンスへの埋め込み（OpenAPI 一方向フロー・ADR-0006）

- **common の Zod**: `PostSchema` / `CommentSchema` に **任意フィールド** `author_worker: AuthorWorkerSchema.optional()` を追加する（後方互換・既存 author は残す）。
- **server**: feed（`/api/feed`）・community feed（`/api/communities/:slug/feed`）・thread（`/api/posts/:postId`）の各レスポンス生成時に、`workerRepo` から**有効ワーカー**（`listBotWorkers`・論理削除除外）を取得 → `buildAuthorWorkerResolver` を組み立て → 各 post/comment に `author_worker` を付与して返す。
  - これらルータに `workerRepo` を注入する（`createFeedRouter` / `createPostsRouter` のシグネチャに追加。`app.ts` で `deps.workerRepository` を渡す）。
  - 付与は「解決できたものだけ」。解決不能な author は `author_worker` 未設定のまま返す（フォールバックは client 側）。
- **server → openapi.json → client**: 生成型に `author_worker` が乗る。生成物（`*.gen.ts` / `openapi.json`）はコミットしない（CI で再生成）。

### 表示（受け入れ条件 1・3）

- **client**: `PostCard` / `CommentCard` で、`author_worker` があれば **MUI `Avatar`**（`src={author_worker.image_url}`・未設定時は displayName 頭文字フォールバック）+ `author_worker.display_name` を表示。`author_worker` が無い（解決できなかった）場合は、従来どおり生の `author` 文字列をテキスト表示（破綻しない）。
  - アバター + 名前の表示パターンは既存 `RecentWorkersSection.tsx` を踏襲する。
- ユーザー入力フィールドは追加しない（受け入れ条件 4）。`.max()` 対象の新規入力なし。

## 入出力（受け入れ条件 → テスト）

### common: `buildAuthorWorkerResolver`（ユニットテスト）

| 入力 author | workers | 期待 |
|---|---|---|
| `"<uuid-haru>"` | `{id:<uuid-haru>, displayName:"haru", imageUrl:"u"}` | `{id:<uuid-haru>, display_name:"haru", image_url:"u"}`（id 照合） |
| `"haru"` | `{id:<uuid-haru>, displayName:"haru"}` | `{..., display_name:"haru", image_url:null}`（displayName 照合・画像無し） |
| `"unknown"` | 任意 | `undefined`（解決不能） |
| `"haru"`（id="haru" の別ワーカーと displayName="haru" の別ワーカーが両方ある） | — | id 一致を優先 |

### server: feed / community feed / thread（ルートテスト）

- post.author が **displayName**（"haru"）でも、当該 DB ワーカーの `author_worker`（display_name + image_url）が付く。
- post.author が **UUID id** でも従来どおり付く（後方互換）。
- 画像未設定ワーカーは `author_worker.image_url=null`。
- 解決できない author は `author_worker` が付かない（フィールド未設定）。

### client: `PostCard` / `CommentCard`（RTL テスト）

- `author_worker.image_url` があるとき `<img>`（alt=display_name）を表示し、display_name を表示する。
- `author_worker.image_url` が無いとき、フォールバック（頭文字）アバター + display_name を表示する。
- `author_worker` が無いとき、生の `author` 文字列を表示する（破綻しない）。

## スコープ外

- ワーカープロフィール詳細ページ・クリック遷移（別 Issue）。
- author を DB id へ統一するデータ移行（#478 と同じく採用しない・移行不要）。
- `RecentWorkersSection` の挙動変更（既に avatar 対応済み）。

## e2e ユースケース

ホームフィード・コミュニティフィード・投稿スレッドで「発言者がアバター画像＋表示名で表示される」というユーザー可視の振る舞いが追加されるため、`e2e/feed/usecases.md`（または該当エリア）にユースケースを追記し、`e2e/usecases.md` のサマリにも反映する。
