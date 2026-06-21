# 設計書: e2e/post-thread の UC-POST-13〜15 を Playwright テストとして実装する (#741)

## 1. 目的 / 背景

`e2e/post-thread/post-thread.spec.ts` の UC-POST-13〜15 が `test.todo()` のまま未実装になっている。
これらはリリース判定（`/release-check`）で検証すべき機能であり、自動テストとして実装することで品質を担保する。

- **UC-POST-13**: OGP カード表示（#515）
- **UC-POST-14**: コメントのネスト（親子）構造表示（#520）
- **UC-POST-15**: コミュニティへのパンくずリンク（#525 / #693 / #780）

## 2. スコープ（やること / やらないこと）

### やること
- UC-POST-13: OGP カード（または URL リンクのフォールバック）が表示されることを確認する
- UC-POST-14: 返信コメントが親コメントの下にインデントされ、L 字コネクターが存在することを確認する
- UC-POST-15: パンくずリンク「ポスト一覧」が表示され、クリックでコミュニティページへ遷移することを確認する

### やらないこと
- 新規 UI の実装（e2e テスト実装のみ）
- UC-POST-16 以降の実装（スコープ外）
- 実バックエンドサーバーを要するヘルパー関数の実装

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. UC-POST-13:
   - `page.route("**/api/posts/*", ...)` で `text` に URL を含む post + comment のスレッドデータを返す
   - `page.route("**/api/ogp?*", ...)` で OGP メタデータ `{ title, description, image, site_name }` を返す
   - `/posts/${postId}` を開いたとき OGP カード（`role="link"` / タイトルテキスト）が表示される
   - OGP 取得失敗時はカードが表示されず、リンクのみが残る（MarkdownContent のリンクが存在する）

2. UC-POST-14:
   - `page.route("**/api/posts/*", ...)` で `parent_comment_id` を持つネストコメントを含むスレッドデータを返す
   - 子コメントのテキストが表示される
   - `data-testid="comment-l-connector"` が存在する（depth > 0 のコメントに L 字コネクターが描画される）

3. UC-POST-15:
   - `page.route("**/api/posts/*", ...)` でコミュニティ付きの post データを返す
   - `page.route("**/api/communities", ...)` でコミュニティ一覧を返す
   - 「ポスト一覧」テキストのリンクが表示される
   - クリックすると `/communities/${slug}` へ遷移する

4. `test.todo()` を実テストに書き換え、usecases.md の期待動作と整合する
5. `pnpm turbo run build lint test` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### 実装アプローチ

既存の `e2e/home-feed/home-feed.spec.ts` や `e2e/community/community.spec.ts` と同様に、
`page.route()` で API をモックするアプローチを採用する。

post-thread.spec.ts の既存実テスト（UC-POST-01〜12）は実 API ヘルパーを使用しているが、
これらのヘルパー（`e2e/helpers/`）は未作成のため現在動作しない状態にある。
UC-POST-13〜15 は `page.route()` モックで独立して実装する。

### API レスポンス形式

`GET /api/posts/:postId` のレスポンス:
```json
{
  "post": {
    "id": "post-1",
    "community_id": "comm-1",
    "slot_key": "2024-01-15T12:00",
    "seq": 0,
    "author": "worker-1",
    "title": "テスト投稿",
    "text": "https://example.com テスト本文",
    "score": 5,
    "comment_count": 2,
    "created_at": "2024-01-15T12:00:00.000Z",
    "author_worker": {
      "id": "worker-1",
      "display_name": "テストワーカー",
      "image_url": null
    }
  },
  "comments": [
    {
      "id": "comment-1",
      "community_id": "comm-1",
      "post_id": "post-1",
      "slot_key": "2024-01-15T12:00",
      "seq": 0,
      "author": "worker-1",
      "text": "親コメント",
      "score": 2,
      "parent_comment_id": null,
      "created_at": "2024-01-15T12:01:00.000Z",
      "author_worker": { "id": "worker-1", "display_name": "テストワーカー", "image_url": null }
    },
    {
      "id": "comment-2",
      "community_id": "comm-1",
      "post_id": "post-1",
      "slot_key": "2024-01-15T12:00",
      "seq": 1,
      "author": "worker-1",
      "text": "子コメント（返信）",
      "score": 1,
      "parent_comment_id": "comment-1",
      "created_at": "2024-01-15T12:02:00.000Z",
      "author_worker": { "id": "worker-1", "display_name": "テストワーカー", "image_url": null }
    }
  ]
}
```

`GET /api/ogp?url=...` のレスポンス:
```json
{ "title": "テスト記事タイトル", "description": "記事の説明", "image": "https://example.com/og.jpg", "site_name": "Example" }
```

`GET /api/communities` のレスポンス:
```json
[{ "id": "comm-1", "slug": "test-community", "name": "テストコミュニティ", ... }]
```

### モックすべき追加 API

スレッドページはいくつかの追加 API を呼ぶため、モックが必要:
- `POST /api/posts/:postId/view` — 閲覧ビーコン（202 を返す）
- `POST /api/posts/:postId/comment-views` — コメント閲覧ビーコン（202 を返す）
- `GET /api/auth/me` — 未ログイン時 401
- `GET /api/communities` — パンくず・サイドバー用

### UC-POST-13 の OGP カード検証

`OgpCard` コンポーネントは `role="link"` の Box として描画される。
`page.getByRole("link", { name: /テスト記事タイトル/ })` で OGP カードを特定できる。
OGP 取得失敗（空レスポンス）時はカードが非表示になることも確認する。

### UC-POST-14 のネストコメント検証

`CommentCard` の depth > 0 時に `data-testid="comment-l-connector"` が描画される。
`page.getByTestId("comment-l-connector")` で L 字コネクターの存在を確認する。

### UC-POST-15 のパンくず検証

`CommunityBreadcrumb` コンポーネントが「ポスト一覧」テキストのリンクを描画する。
`page.getByRole("link", { name: /ポスト一覧/ })` で取得し、クリック後の URL を確認する。

## 5. 影響範囲 / 既存への変更

- `e2e/post-thread/post-thread.spec.ts`: UC-POST-13,14,15 の test.todo を実テストに書き換え
- 新規ファイル: なし
- client/server/common/docs: 変更なし

## 6. テスト計画（TDD で書くテスト一覧）

| UC | テスト内容 | 検証ポイント |
|----|-----------|------------|
| UC-POST-13 | OGP カード表示（成功ケース） | `role="link"` で OGP タイトルテキストが visible |
| UC-POST-13 | OGP カード非表示（失敗ケース） | `role="link"` + OGP タイトルが存在しない（フォールバック） |
| UC-POST-14 | ネストコメントのインデント | 子コメントテキストが visible + `comment-l-connector` が存在する |
| UC-POST-15 | パンくずリンクの表示 | 「ポスト一覧」リンクが visible |
| UC-POST-15 | パンくずリンクのクリック遷移 | クリック後 URL が `/communities/${slug}` になる |

## 7. リスク・未決事項

- 閲覧ビーコン（view / comment-views）の POST リクエストがモックなしで実 API を叩く場合、エラーが発生するリスクがある。モックで 202 を返すことで回避する。
- OGP API（`/api/ogp?url=...`）は URL にクエリパラメータがあるため、`**/api/ogp?*` でワイルドカードマッチする。
- コミュニティ一覧 API は `communities` のパスマッチが必要（サイドバー・パンくず両方が呼ぶ）。
- TanStack Router のナビゲーションは SPAのため、`page.waitForURL` でクリック後の遷移を待機する。
