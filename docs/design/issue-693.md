# Issue #693 設計書: PostThreadScene のコミュニティパンくずを「ポスト一覧」へ戻るリンクに変更

## 背景と目的

`/posts/$postId`（PostThreadScene）の左カラム上部にあるコミュニティパンくずリンク（`CommunityBreadcrumb` コンポーネント）が、現在は `c/{community.slug}` というコミュニティ識別子を表示している。

この表示は「コミュニティ識別子の表示」であり、ユーザーが「どこへ戻れるか」を直感的に把握しにくい。ポスト詳細画面のナビゲーションとして、「ポスト一覧」という文言の方がユーザーの意図（前画面に戻る）と合致する。

## 変更内容

### `client/src/routes/PostThreadScene.tsx`

`CommunityBreadcrumb` コンポーネントの `Typography` テキストを変更する:

- **変更前**: `c/{community.slug}`
- **変更後**: `ポスト一覧`

リンク先（`/communities/$slug`）とスタイル（`color: text.secondary`, `fontWeight: 600`）は維持する。

### `client/src/routes/PostThreadScene.test.tsx`

#525 のテスト（`PostThreadScene コミュニティパンくず (#525)`）を更新する:

- `getByRole("link", { name: /c\/ai-dev/ })` → `getByRole("link", { name: "ポスト一覧" })` に変更
- `queryByText(/c\//)` → `queryByText("ポスト一覧")` に変更
- `queryByText(/c\/ai-dev/)` → `queryByText("ポスト一覧")` に変更

## 設計判断

- `client/` のみの変更（`server/`, `common/` は非変更）
- リンク先・スタイルは Issue 受け入れ条件通り維持
- 矢印装飾は付けない（シンプルに `ポスト一覧` のみ）

## テスト戦略

TDD アプローチ:
1. テストを更新して `ポスト一覧` テキストの存在を検証
2. 実装コードを更新してテストを通す

既存テストのうち `queryByText(/c\//)` および `getByRole("link", { name: /c\/ai-dev/ })` は文言変更により更新が必要。
