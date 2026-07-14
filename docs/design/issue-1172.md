# 設計書: client/src/components/RelatedPostsSection.tsx のテストを追加する (#1172)

## 1. 目的 / 背景

`client/src/components/RelatedPostsSection.tsx`（#1087 で追加、投稿詳細の「関連投稿」セクション）に対応するテストファイルが存在しない。`posts` が空配列のとき `null` を返す分岐と、1 件以上のとき各投稿へのリンク・タイトル・投稿時刻を描画する分岐の両方が未検証のまま本番稼働している。

空状態の描画有無は CLAUDE.md の e2e ユースケース保守方針が重視する「観察可能な期待動作」の一つでもあり、コンポーネント単体で検証できるようにしておく価値がある。

## 2. スコープ（やること / やらないこと）

**やること**:
- `client/src/components/RelatedPostsSection.test.tsx` を新設する
- `posts` が空配列のときセクションが描画されないことのテスト
- `posts` が1件以上のとき、各投稿のタイトル・リンク（`/posts/$postId`）・投稿時刻が描画されることのテスト
- 複数件描画時に全件表示されることのテスト

**やらないこと**:
- 関連投稿の取得ロジック（サーバ側のタグ一致検索・`fetchCommunityFeedPage` 等）の変更・テストは対象外（表示コンポーネント単体に閉じる）
- `RelatedPostsSection.tsx` 本体の実装変更（既存の動作を変えない。テスト追加のみ）
- `PostThreadScene.tsx` 側の統合テストの追加・変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `client/src/components/RelatedPostsSection.test.tsx` を新設する（`@testing-library/react`）。
2. `posts` が空配列のとき、`data-testid="related-posts-section"` が描画されないことをテストする。
3. `posts` が1件以上のとき、各投稿のタイトルリンクが `/posts/$postId` へのリンクとして描画されることをテストする。
4. `pnpm turbo run build|test|lint` が緑であること。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### テスト対象コンポーネントの確認

`RelatedPostsSection`（`client/src/components/RelatedPostsSection.tsx`）は `posts: Post[]` を受け取り:
- `posts.length === 0` のとき `null` を返す（セクション自体が描画されない）
- それ以外は `data-testid="related-posts-section"` の `Box` 内に、各投稿を `<li>` として `RouterLink`（`to="/posts/$postId"` params `{ postId: post.id }`）でラップしたタイトルと `PostedTime` を描画する

### テスト方針

既存の類似コンポーネントテスト（`RecentPostsSidebarCard.test.tsx`）のパターンに倣う:
- `@tanstack/react-router` の `Link` を `vi.mock` で `<a href>` にモックし、`params` を `to` に埋め込んで実際の href を検証できるようにする。
- `Post` 型のモックは `PostCard.test.tsx` / `RecentPostsSidebarCard.test.tsx` と同様、テストに必要な最小フィールドを持つオブジェクトとして用意する。
- テストケース:
  1. `posts` が空配列 → `screen.queryByTestId("related-posts-section")` が `null`
  2. `posts` が1件 → セクションが描画され、タイトルが表示され、そのタイトルを含むリンクの `href` が `/posts/<postId>` になる
  3. `posts` が複数件 → 全件のタイトルが表示される

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client）

- 新規: `client/src/components/RelatedPostsSection.test.tsx`
- 既存ファイルの変更なし（`RelatedPostsSection.tsx` 本体は変更しない）

## 6. テスト計画（TDDで書くテスト一覧）

### RelatedPostsSection.test.tsx

- `posts` が空配列のとき `related-posts-section` が描画されない
- `posts` が1件のときタイトルが表示される
- `posts` が1件のとき `/posts/$postId` へのリンクとして描画される（href 検証）
- `posts` が複数件のとき全件のタイトルが表示される

## 7. リスク・未決事項

- ユーザー可視の振る舞い自体は変更しない（テスト追加のみ）ため、`e2e/usecases.md` の更新は不要。PR 本文にその旨を明記する。
