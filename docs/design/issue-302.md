# 設計書: AppHeader をスクロール方向に応じて表示／非表示する (#302)

## 1. 目的 / 背景

`client/src/components/AppHeader.tsx` は `position: "sticky"; top: 0` で常駐しているが、post 一覧・コメントスレッド閲覧中も常に表示され閲覧領域を圧迫している。Reddit / モバイルアプリ共通の「下スクロールでヘッダを隠して本文を広く・上スクロールで即出す」UX を実装し、フェードアニメーションで切り替える。

スクロールコンテナは `client/src/routes/RootLayout.tsx` の `<Box component="main" sx={{ overflow: "auto" }}>`。`AppHeader` は `RootLayout` の外側（上部）に置かれており、`AppHeaderProps` で制御する。

## 2. スコープ（やること / やらないこと）

### やること
- スクロール方向 → ヘッダ表示可否の判定を行う**純粋関数** `decideHeaderVisibility` を `client/src/utils/scrollHeader.ts` に実装（Vitest でテスト）
- スクロールイベントを購読し表示状態を返す hook `useHideOnScroll` を `client/src/hooks/useHideOnScroll.ts` に実装（`prefers-reduced-motion` 尊重を内包）
- `RootLayout` の `<main>` の `onScroll` で `useHideOnScroll` を駆動し、`AppHeader` に `hidden` を渡す
- `AppHeader` に `hidden?: boolean` prop を追加し、`opacity` / `translateY` の CSS `transition` で出し入れ（所要時間は定数）
- `prefers-reduced-motion: reduce` 環境ではアニメーションと自動非表示を無効化し常時表示

### やらないこと
- サイドバー連動・コミュニティ固有ヘッダのスクロール連動（別 Issue）
- サーバ・API・OpenAPI スキーマの変更（client 内に閉じる）
- グローバル状態管理の導入（ADR-0003）

## 3. 受け入れ条件（テストに落とせる粒度）

1. スクロール方向検知を `<main>` の `onScroll`（hook `useHideOnScroll`）で行い、下スクロールで非表示・上スクロールで表示・最上部付近では常に表示する
2. 表示・非表示は `opacity` / `translateY` の CSS `transition` でアニメーションし瞬間的に消えない。所要時間は定数で調整可能
3. 判定ロジックを副作用から分離した純粋関数 `decideHeaderVisibility` として実装し、Vitest で「下スクロールで非表示」「上スクロールで表示」「最上部では表示」「しきい値未満の微小スクロールで状態維持」をカバー
4. `prefers-reduced-motion: reduce` 環境ではアニメーション・自動非表示を無効化し常時表示
5. 既存機能維持（ハンバーガー / ユーザーメニュー / ログインリンク）。`AppHeader.test.tsx` の既存テストが緑
6. サーバ・API・OpenAPI 不変。`build test lint` 緑、`client → common` 一方向 import 境界維持

## 4. 設計方針

### 純粋関数 `decideHeaderVisibility`（utils/scrollHeader.ts）
```ts
interface ScrollHeaderState { lastScrollTop: number; hidden: boolean; }
interface DecideParams { currentScrollTop: number; topThreshold: number; minDelta: number; }
function decideHeaderVisibility(prev: ScrollHeaderState, p: DecideParams): ScrollHeaderState
```
- `currentScrollTop <= topThreshold` → 常に表示（`hidden: false`）
- `|currentScrollTop - prev.lastScrollTop| < minDelta` → 状態維持（チラつき防止）。`lastScrollTop` も維持（微小移動を無視して累積させない）
- 下方向（`current > prev.lastScrollTop`）→ `hidden: true`
- 上方向 → `hidden: false`
- いずれも `lastScrollTop` を `currentScrollTop` に更新（しきい値超え時のみ）

### hook `useHideOnScroll`（hooks/useHideOnScroll.ts）
- `prefers-reduced-motion: reduce` を `useMediaQuery("(prefers-reduced-motion: reduce)")` で検出。reduce 時は常に `hidden=false` を返し `onScroll` でも更新しない
- 内部 `ref` で `ScrollHeaderState` を保持し、`onScroll` ハンドラを返す（`{ hidden, onScroll, prefersReducedMotion }`）
- 定数 `TOP_THRESHOLD` / `MIN_SCROLL_DELTA` を export

### AppHeader
- `hidden?: boolean` を追加。`hidden && !prefersReducedMotion` のとき `transform: translateY(-100%); opacity: 0`、それ以外は `translateY(0); opacity: 1`
- `transition` に `HEADER_TRANSITION_MS` 定数を使用。`prefers-reduced-motion` 時は `transition: none`（AppHeader 自身でも `useMediaQuery` で尊重）

### RootLayout
- `useHideOnScroll()` を呼び、`<main>` に `onScroll` を、`<AppHeader hidden={...} />` を渡す

## 5. 影響範囲 / 既存への変更

対象ワークスペース: **client のみ**
- 新規: `client/src/utils/scrollHeader.ts` + `.test.ts`
- 新規: `client/src/hooks/useHideOnScroll.ts` + `.test.ts`
- 変更: `client/src/components/AppHeader.tsx`（`hidden` prop・transition）
- 変更: `client/src/routes/RootLayout.tsx`（hook 接続・onScroll）

## 6. テスト計画（TDD）

- `scrollHeader.test.ts`: 下スクロールで非表示 / 上スクロールで表示 / 最上部では表示 / しきい値未満で状態維持
- `useHideOnScroll.test.ts`: onScroll で hidden が切り替わる / prefers-reduced-motion で常に表示・更新されない
- 既存 `AppHeader.test.tsx` が緑のまま（回帰なし）

## 7. リスク・未決事項
- `prefers-reduced-motion` の matchMedia モックは jsdom で要スタブ（既存 `useIsMobile.test.ts` の手法を踏襲）
- しきい値の具体値は UX 調整で変わりうるが定数化で吸収
