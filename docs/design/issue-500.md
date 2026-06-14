# Issue #500 設計書: フィードと投稿カードにコメント数（💬 件数）を表示する

## 背景・目的

ホームフィード（`GET /api/feed`）・コミュニティフィード（`GET /api/communities/:slug/feed`）の各投稿に
コメント件数フィールドが無く、`PostCard` もコメント数を描画していない。掛け合いが盛り上がっている
スレッドをフィード段階で一目で見つけられるよう、各投稿カードに「💬 N」を表示する。

## 受け入れ条件 → 入出力

### AC1: フィード API レスポンスにコメント件数フィールドを含める

- `PostSchema`（common）に `comment_count: z.number().int().nonnegative().default(0)` を追加する
  （内部集計値・ユーザー入力ではないため `.max()` 対象外）。
- `GET /api/feed`（latest / popular 両方）と `GET /api/communities/:slug/feed` の各 post に
  `comment_count` を含める。コメントが付いていない post は `0`。
- OpenAPI（`pnpm --filter @hatchery/server openapi`）に反映され、client 型生成へ流れる（ADR-0006）。

### AC2: N+1 を避けたコメント件数集計

- `CommentRepository` に `countByPostIds(postIds: string[]): Promise<Map<string, number>>` を追加する。
  - in-memory 実装: 全レコードを走査して postId ごとに集計。
  - Prisma 実装: `comment.groupBy({ by: ["postId"], where: { postId: { in } }, _count })` で 1 クエリ集計。
  - 空配列を渡したら空 Map を返す（クエリを投げない）。
  - 集計に現れない postId は呼び出し側で 0 とみなす。
- ルートに `attachCommentCount`（`server/src/routes/commentCount.ts`）を追加し、post レコード配列に
  `commentCount` を付与する。`toPostResponse` は `commentCount`（任意・既定 0）を受けて `comment_count` を出力。

### AC3: PostCard のコメント数表示

- `PostCard` が `post.comment_count` を受け取り「💬 N」を常に表示する（N=0 でも「💬 0」を出す。
  どの投稿にコメントが付いていないかも一目で分かるようにするため）。
- アクセシビリティ: `aria-label="コメント N 件"` を付与しテストで検証する。

### AC4: テスト・ビルド・境界

- server: `commentRepository`（in-memory）の `countByPostIds` ユニット、feed / community feed の結合テストで
  `comment_count` を検証。
- client: `PostCard` の RTL テストにコメント数表示ケース（N>0 / N=0）を追加。
- `pnpm turbo run build test lint` が緑。import 境界（client→common / server→common 一方向）を破らない。

## スコープ外

- コメント数順ソート（Issue 明記のとおり対象外）。

## ユーザー可視の振る舞い変更

フィードの各投稿カードに「💬 N」が表示される。`e2e/feed/usecases.md` にユースケースを追記する。
