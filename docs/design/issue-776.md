# Issue #776 設計書: コンパクト表示モードを廃止しカード表示に統一する

## 背景

コンパクトモードは本文テキストを非表示にするだけで UX 上のメリットが薄く、実装の複雑さ（`compact` prop・`useViewMode` hook・localStorage 永続化・トグルボタン）に見合わない。廃止してカード表示に統一する。

## 対象ファイル

### 削除
- `client/src/hooks/useViewMode.ts` — `ViewMode` 型・`useViewMode` hook 本体
- `client/src/hooks/useViewMode.test.ts` — hook のテスト 5 件

### 編集
- `client/src/components/PostCard.tsx` — `compact` prop とすべての分岐を除去
- `client/src/components/PostCard.test.tsx` — `describe("compact モード")` ブロック削除
- `client/src/routes/HomeFeedScene.tsx` — useViewMode 関連コードをすべて除去
- `client/src/routes/CommunityScene.tsx` — useViewMode 関連コードをすべて除去

## 変更内容

### PostCard.tsx の変更
- `compact?: boolean` prop を interface から除去
- 関数引数の `compact = false` を除去
- `p: compact ? 1 : 2` → `p: 2` に統一
- `mb: compact ? 0.5 : 1` → `mb: 1` に統一
- `mb: compact ? 0 : 0.5` → `mb: 0.5` に統一
- `mb: compact ? 0.5 : 1` → `mb: 1` に統一
- `{!compact && (<MarkdownContent .../>)}` → 常に表示するよう除去

### HomeFeedScene.tsx の変更
- `import { useViewMode } from "../hooks/useViewMode.js"` を除去
- `import ViewStreamIcon from "@mui/icons-material/ViewStream"` を除去
- `import ViewHeadlineIcon from "@mui/icons-material/ViewHeadline"` を除去
- `const { viewMode, toggleViewMode } = useViewMode()` を除去
- トグルボタン（`aria-label="表示モードを切り替え"`）を除去
- `compact={viewMode === "compact"}` prop を除去

### CommunityScene.tsx の変更
- `import { useViewMode } from "../hooks/useViewMode.js"` を除去
- `import ViewStreamIcon from "@mui/icons-material/ViewStream"` を除去
- `import ViewHeadlineIcon from "@mui/icons-material/ViewHeadline"` を除去
- `const { viewMode, toggleViewMode } = useViewMode()` を除去
- トグルボタンを含む `Box（display: flex, justifyContent: flex-end）` ブロックを除去
- `compact={viewMode === "compact"}` prop を除去

### localStorage
- `feedViewMode` キーの読み書きは `useViewMode.ts` 削除により完全に消滅する

## 受け入れ条件

1. `useViewMode.ts` / `useViewMode.test.ts` が削除されている
2. `PostCard.tsx` の `compact` prop とすべての分岐が除去されている（常にカード表示）
3. `PostCard.test.tsx` の `describe("compact モード")` が削除されている
4. `HomeFeedScene.tsx` から useViewMode 関連コードが除去されている
5. `CommunityScene.tsx` から useViewMode 関連コードが除去されている
6. `pnpm turbo run build test lint` が緑
7. PR 本文に `Closes #776` と `Closes #749` が含まれる

## 依存関係

- open 中の #749（compact 時 padding 修正）は本 Issue の実装で無効になる。PR に `Closes #749` を含める。
- server / common への影響なし: client 内の UI 変更のみ。
