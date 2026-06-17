# Issue #660 設計書: PostThreadSkeleton コンポーネントの render テストを追加する

## 背景と目的

`client/src/components/PostThreadSkeleton.tsx` は投稿スレッドのローディングスケルトン（Suspense fallback）だが、テストが存在しない。
#692 にて PostThreadSkeleton が PostThreadScene の実 UI レイアウトと一致するよう大幅に構造改修された（サブコンポーネント分割: PostCardSkeleton / CommentCardSkeleton / CommunitySidebarSkeleton）。

本 Issue では、改修後の構造に合わせたスモークテストを追加し、Skeleton コンポーネントの import や MUI 依存の不整合を早期検出できるようにする。

## 実装方針

### テストファイル

`client/src/components/PostThreadSkeleton.test.tsx` を新規作成する。

### テスト設計

参照実装は `client/src/components/MainContentSkeleton.test.tsx`。

**テストケース 1: 基本 render テスト**
- `render(<PostThreadSkeleton />)` がクラッシュしないこと
- `data-testid="post-thread-skeleton"` 要素が DOM に存在すること

**テストケース 2: Skeleton 要素が複数描画される**
- #692 で構造改修された PostThreadSkeleton は PostCardSkeleton / CommentCardSkeleton / CommunitySidebarSkeleton の各サブコンポーネントを含む複合構造
- MUI `Skeleton` のレンダリングを確認するため、`.MuiSkeleton-root` クラスを持つ要素が複数存在することを確認する

### 依存・制約

- Vitest + React Testing Library を使用（既存パターンに準拠）
- client ワークスペースのみ変更する
- `pnpm --filter @hatchery/client test` が通過すること

## スコープ外

- PostThreadScene の統合テストは `client/src/routes/PostThreadScene.test.tsx` で別途管理
- サブコンポーネント（PostCardSkeleton / CommentCardSkeleton / CommunitySidebarSkeleton）の個別テストは不要

## 検証方法

- `pnpm turbo run test lint` が全緑
