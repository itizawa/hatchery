# 設計書: PostThreadSkeleton レイアウト一致 (#955)

## 1. 目的 / 背景

`/posts/$postId` 初回ロード中に表示される `PostThreadSkeleton` のレイアウトコンテナが、
実 UI（`PostThreadScene`）と一部乖離している。特に右サイドバーの Box に `position: "sticky"` / `top` が
欠けており、ローディング完了後にレイアウトシフト（CLS）が発生する。

## 2. スコープ（やること / やらないこと）

**やること**
- `PostThreadSkeleton` の右カラム Box の sx を `PostThreadScene.SidebarColumn` と一致させる
  （`position: "sticky"`, `top: 24` を追加）
- 左カラム・右カラムに `data-testid` を付与し、RTL テストで検証できるようにする
- RTL テストを追加する（構造・右カラム sticky の検証）

**やらないこと**
- `SidebarColumn` の共通コンポーネント化（スコープを最小限にするため今回は行わない。
  設計上は「でもよい」と認められている代替案。変更が最小で受け入れ条件を満たせるため、
  単純な sx 修正を選択する）
- PostCard / CommentCard / CommunitySidebarCard の内部 loading 表現の変更
- コメントスケルトン件数の変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `data-testid="post-thread-skeleton-left"` が描画されること（左カラム存在確認）
2. `data-testid="post-thread-skeleton-sidebar"` が描画されること（右カラム存在確認）
3. 左カラムと右カラムが同一フレックスコンテナー内に並ぶこと
4. 右カラムは xs で `display: none` になること（`display: { xs: "none", md: "block" }` による）
5. 既存の `data-testid="post-thread-skeleton"` が維持されること
6. `pnpm turbo run build test lint` が緑になること

## 4. 設計方針（アーキ・データ構造・主要モジュール）

**設計判断**: SidebarColumn の共通コンポーネント化は行わず、PostThreadSkeleton の右カラム Box に
`position: "sticky"` / `top: 24` を追加するシンプルな修正を選択する。

理由:
- スコープが `client/src/components/PostThreadSkeleton.tsx` 1 ファイル内で完結する
- 新規ファイル作成・既存ファイルへの影響が最小
- 単一情報源のメリットより変更の局所性を優先できる規模のコード

## 5. 影響範囲 / 既存への変更

- **対象ワークスペース**: `client/` のみ
- 変更ファイル:
  - `client/src/components/PostThreadSkeleton.tsx`（sx 修正 + data-testid 追加）
  - `client/src/components/PostThreadSkeleton.test.tsx`（テスト追加）
  - `docs/design/issue-955.md`（本設計書）

## 6. テスト計画（TDD で書くテスト一覧）

| # | テスト内容 | 状態 |
|---|-----------|------|
| T1 | 左カラム `data-testid="post-thread-skeleton-left"` が描画される | 新規 |
| T2 | 右カラム `data-testid="post-thread-skeleton-sidebar"` が描画される | 新規 |
| T3 | 左・右カラムが同一フレックスコンテナー内に並ぶ（2カラム構造） | 新規 |
| T4 | 右カラムが xs で `display: none` になる | 新規 |
| T5 | `data-testid="post-thread-skeleton"` が描画される | 既存（維持） |
| T6 | Skeleton 要素が複数描画される | 既存（維持） |

## 7. リスク・未決事項

- jsdom で Emotion injected styles の `getComputedStyle` が正しく読めるかは実行時に確認する。
  読めない場合は T4 の検証方法を変更する（DOM 構造の確認に置き換え）。
- 本変更はユーザー可視の振る舞いを変更しない（ローディング表示の視覚調整のみ）ため、
  `e2e/` の更新は不要。
