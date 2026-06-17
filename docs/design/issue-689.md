# 設計書: スクロール時に画面右下へトップ戻しボタンを表示する (#689)

## 1. 目的 / 背景

ホームフィードやスレッドページは無限スクロールで投稿が増え続けるため、一度下にスクロールするとトップへ戻るのにユーザーが手動で戻さなければならない。`RootLayout.tsx` の `<Box component="main">` がスクロールコンテナ（`overflow: auto`）であり、ここのスクロール量を監視してボタン表示を切り替える。

## 2. スコープ（やること / やらないこと）

### やること
- `client/src/components/ScrollToTopButton.tsx` を新規作成（MUI `Fab` + `KeyboardArrowUpIcon`、`aria-label="トップへ戻る"`）
- `RootLayout.tsx` の `<Box component="main">` に `ref` を付け、スクロール量 300px 超で `ScrollToTopButton` を `Fade` で表示
- クリックで `scrollTop = 0`（`behavior: 'smooth'`）。`window.scrollTo` は使わない
- `client/src/components/ScrollToTopButton.test.tsx` を新規作成

### やらないこと
- しきい値・アニメーション種別のカスタマイズ
- server / common / docs への変更

## 3. 受け入れ条件（テストに落とせる粒度）

1. `Fab` + `KeyboardArrowUpIcon`、`aria-label="トップへ戻る"` が存在する
2. スクロール量 < 300 では `Fade` in=false（非表示）
3. スクロール量 ≥ 300 では `Fade` in=true（表示）
4. クリックで `scrollTo({ top: 0, behavior: 'smooth' })` が呼ばれる
5. `pnpm test` / `pnpm lint` 全緑

## 4. 設計方針

### ScrollToTopButton コンポーネント

- Props: `scrollContainerRef: RefObject<HTMLElement | null>`
- `useEffect` で `scrollContainer` の `scroll` イベントを購読し、`scrollTop >= 300` で `visible` state を true にする
- `Fade` でラップし `in={visible}` でアニメーション付き表示/非表示
- `position: fixed`, `bottom: 24px`, `right: 24px` の `Box` 内に `Fab size="small"` を配置
- クリックハンドラ: `scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })`

### RootLayout.tsx への変更

- `useRef<HTMLElement | null>(null)` を追加
- `<Box component="main" ref={mainRef} ...>` に `ref` を付与
- `<Outlet />` の後（`Suspense` 内部の外側）に `<ScrollToTopButton scrollContainerRef={mainRef} />` を配置

### uiParts への追加

- `Fab` を `@mui/material/Fab` からエクスポート追加
- `Fade` を `@mui/material/Fade` からエクスポート追加

## 5. 影響範囲

- `client/src/components/uiParts/index.ts`（`Fab`・`Fade` を追加）
- `client/src/components/ScrollToTopButton.tsx`（新規）
- `client/src/components/ScrollToTopButton.test.tsx`（新規）
- `client/src/routes/RootLayout.tsx`（`ref` と `ScrollToTopButton` を追加）

## 6. テスト計画

`ScrollToTopButton.test.tsx` に以下を実装:

- (a) スクロール量 < 300 では Fade が `in=false`（ボタン非表示 / aria-hidden）
- (b) スクロール量 ≥ 300 では Fade が `in=true`（ボタン表示）
- (c) クリックで `scrollTo` が呼ばれる

テスト実装方針:
- `scrollContainer` を `HTMLDivElement` モックとし、`scrollTop` を手動で設定後 `scroll` イベントを発火
- `vi.fn()` で `scrollTo` をモックしてクリック後の呼び出しを検証

## 7. リスク・未決事項

- jsdom は `scrollTo` をサポートしないためテストでは `vi.spyOn` / `Object.defineProperty` でモックが必要
