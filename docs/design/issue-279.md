# 設計書: fix: サイドバーが横スクロールしないと表示されない（ページ全体の横オーバーフローを解消する） (#279)

## 1. 目的 / 背景

デスクトップ幅でアプリを開いたとき、ページ全体に横スクロールが発生し、サイドバーが見切れる問題を解消する。
`RootLayout.tsx` のトップレベルコンテナに横幅の制約が無く、`AppHeader` の `position: sticky; width: "100%"` がドキュメント全体の幅に引っ張られることが根本原因。

## 2. スコープ（やること / やらないこと）

**やること:**
- `RootLayout.tsx` のトップレベル Box に `width: "100%"` / `maxWidth: "100%"` / `overflowX: "hidden"` を付与
- `OfficeScene.tsx` の OfficeView ラッパーに `width: "100%"` を追加（内部スクロール用コンテナが幅制約を持つように）
- リグレッション防止テストを追加

**やらないこと:**
- モバイル幅のドロワー挙動の改善（#190 対応済み）
- サイドバー幅のレスポンシブ可変化（別 Issue）
- #280 の仮想オフィスのレスポンシブ化

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `RootLayout.tsx` のトップレベルコンテナ（outer Box）に横オーバーフロー防止ガード（`overflowX: "hidden"`）が存在する
2. デスクトップ幅でサイドバー（`aria-label="サイドバー"`）が表示される（既存テスト）
3. `main` 要素に `minWidth: 0` が維持されている
4. OfficeScene の OfficeView ラッパー Box に `width: "100%"` が設定されている（内部スクロールが機能する構造）
5. 既存テスト（#190, #273）が引き続き緑
6. `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### 変更 1: RootLayout.tsx 外側 Box に幅制約を追加

```tsx
// 変更前
<Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>

// 変更後
<Box sx={{ display: "flex", flexDirection: "column", height: "100vh", width: "100%", maxWidth: "100%", overflowX: "hidden" }}>
```

- `width: "100%"`: ビューポート幅 = 親（body）の幅に固定
- `maxWidth: "100%"`: ビューポート幅を超えないよう制約
- `overflowX: "hidden"`: 保険。根本対処が効いていればここで clip は起きない

### 変更 2: OfficeScene.tsx OfficeView ラッパーに width 制約を追加

```tsx
// 変更前
<Box sx={{ mt: 2, overflowX: "auto" }}>

// 変更後
<Box sx={{ mt: 2, overflowX: "auto", width: "100%" }}>
```

- `width: "100%"` を付与することで、このコンテナが親（main）の幅で制約される
- `overflowX: "auto"` がコンテナ幅を超えた OfficeView の水平スクロールを内部で吸収する

### テスト戦略

jsdom はレイアウト計算を行わないため `scrollWidth` での検証は不可。代わりにレイアウト構造（ガード要素の存在）を `data-testid` + DOM 存在確認で検証する。

- `RootLayout.test.tsx` に `"横オーバーフロー防止 (#279)"` describe を追加
- `OfficeScene.test.tsx` に `"横スクロール内部コンテナ (#279)"` describe を追加

## 5. 影響範囲 / 既存への変更

- `client/src/routes/RootLayout.tsx` — outer Box の sx 変更
- `client/src/routes/OfficeScene.tsx` — OfficeContent 内 Box の sx 変更
- `client/src/routes/RootLayout.test.tsx` — テスト追加
- `client/src/routes/OfficeScene.test.tsx` — テスト追加

依存方向（client → common）の変更なし。

## 6. テスト計画（TDDで書くテスト一覧）

### RootLayout.test.tsx

```
describe("横オーバーフロー防止 (#279)")
  it("デスクトップ幅でトップレベルコンテナ（data-testid='root-layout-outer'）がレンダリングされる")
  it("デスクトップ幅でサイドバーが表示され、メインコンテンツ領域も表示される（レイアウト共存）")
```

### OfficeScene.test.tsx

```
describe("横スクロール内部コンテナ (#279)")
  it("OfficeView のラッパーコンテナ（data-testid='office-scroll-container'）がレンダリングされる")
```

## 7. リスク・未決事項

- `overflowX: "hidden"` を outer Box に設定することで、本来意図していた何らかの横方向コンテンツがクリップされる可能性がある（ポップオーバー/ドロップダウン等）。MUI の Popover/Menu は `position: fixed` のため影響を受けない。通常の可視域で動くコンポーネントのみ影響。
- OfficeScene の `width: "100%"` 追加は視覚的変化なし（既に親の幅に収まっているはず）。
