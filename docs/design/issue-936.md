# 設計書: 共有メニュー(Menu)のスタイルを腐敗防止層に共通化し角丸・影・位置を調整する (#936)

## 1. 目的 / 背景

`client/src/components/uiParts/index.ts` で `Menu` は `@mui/material/Menu` を素通しで re-export しており、スタイル指定が一切ない。`ShareButton.tsx` と `AppHeader.tsx` の 2 箇所が同じ生 `Menu` を使っており、統一されたメニュースタイルが存在しない。

腐敗防止層（`uiParts`）に MUI `Menu` のラッパーを設け、角丸・影・アンカーからのオフセットを一元定義する。

## 2. スコープ（やること / やらないこと）

### やること
- `client/src/components/uiParts/Menu.tsx` を新設（MUI `Menu` ラッパー）
- `uiParts/index.ts` の `Menu` を新ラッパーの re-export に差し替え
- 共通スタイル: border-radius 12px / 弱い影 / marginTop 8px (アンカーから 8px 下方向オフセット)
- `slotProps` マージ（呼び出し側が渡した `slotProps.paper.sx` を上書きしない）
- テスト追加: `client/src/components/uiParts/Menu.test.tsx`

### やらないこと
- `Popover`・`Dialog` 等への共通スタイル展開（別 Issue）
- `theme.ts` の `MuiMenu` styleOverrides による一元化（要望どおり uiParts ラッパー方式）
- `ShareButton.tsx` / `AppHeader.tsx` 呼び出し側の変更（API 互換なので不要）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `uiParts` から import した `Menu` を render したとき、Paper に `border-radius: 12px` が適用される
2. Paper に弱い影（`box-shadow: 0 1px 4px rgba(0,0,0,0.08)`）が適用される（禁止パターン `0 4px 6px rgba(0,0,0,0.1)` 系は使わない）
3. Paper に `margin-top: 8px`（アンカーから 8px 下方向オフセット）が適用される
4. 呼び出し側が `slotProps.paper.sx` を追加渡ししても共通スタイルが壊れない（マージされる）
5. 既存 `ShareButton.test.tsx` の全テストが緑のまま
6. 既存 `AppHeader.test.tsx` の全テストが緑のまま（ヘッダー本体の `boxShadow` アサーションへの影響なし）
7. `pnpm turbo run build test lint` が全て緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### ラッパーコンポーネントの方針

`Tooltip.tsx` と同様のパターン: MUI コンポーネントを import し、既定 props を注入して透過する薄いラッパー。

```tsx
import MuiMenu from "@mui/material/Menu";
import type { MenuProps } from "@mui/material/Menu";

const MENU_PAPER_SX = {
  borderRadius: "12px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  marginTop: "8px",
};

export const Menu = ({ slotProps, ...props }: MenuProps) => (
  <MuiMenu
    slotProps={{
      ...slotProps,
      paper: {
        ...slotProps?.paper,
        sx: { ...MENU_PAPER_SX, ...(slotProps?.paper as { sx?: object } | undefined)?.sx },
      },
    }}
    {...props}
  />
);
```

### slotProps マージ戦略

`slotProps.paper.sx` を `{ ...MENU_PAPER_SX, ...callerSx }` でマージ。共通スタイルが既定値として効き、呼び出し側が個別に上書きしたい場合は上書き可能。

## 5. 影響範囲 / 既存への変更

- **変更ファイル**:
  - `client/src/components/uiParts/Menu.tsx`（新規）
  - `client/src/components/uiParts/index.ts`（Menu の export 先を差し替え）
- **呼び出し側に変更なし**: `ShareButton.tsx`・`AppHeader.tsx` は `uiParts` から import するため、ラッパーへの差し替えで自動的に共通スタイルが適用される。

## 6. テスト計画（TDDで書くテスト一覧）

`client/src/components/uiParts/Menu.test.tsx`:
1. Paper に border-radius: 12px が適用される
2. Paper に弱い影（0 1px 4px rgba(0,0,0,0.08)）が適用される
3. Paper に margin-top: 8px が適用される
4. 呼び出し側が `slotProps.paper.sx` を追加渡ししても共通スタイルがマージされる
5. `children` が正しくレンダリングされる（MUI Menu の props 透過性）

## 7. リスク・未決事項

- MUI v9 の `slotProps.paper` 型は `Partial<PaperProps>` → `sx` は `SxProps<Theme>` 型。型アサーションを最小限にしてキャストが必要な箇所を抑える。
- `AppHeader.test.tsx` の「ヘッダーの区切りに boxShadow を使わない」アサーションはヘッダー本体 (`data-testid="app-header"`) に対するテストのため、メニュー Paper への影適用は影響しない。
