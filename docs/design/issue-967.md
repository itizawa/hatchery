# 設計書: feat: 主要なページ遷移に控えめな fade のビュー遷移アニメーション（TanStack Router viewTransition）を導入する (#967)

## 1. 目的 / 背景

「放置して眺める観察エンタメ」という性質上、ホームフィード ⇄ 投稿スレッド ⇄ コミュニティ間の遷移が頻繁に発生する。現状は瞬時切り替えのみで視覚的連続性がない。ブラウザネイティブの View Transitions API（TanStack Router 経由）で控えめな fade を加え、Linear / Vercel Dashboard 風の高品位体験を実現する。

## 2. スコープ（やること / やらないこと）

### やること
- `createAppRouter` に `defaultViewTransition: true` を追加（全ルートでビュー遷移を有効化）
- `AppRoot.tsx` に MUI `GlobalStyles` で `::view-transition-old/new` の fade CSS を注入
- `prefers-reduced-motion: reduce` 時のアニメーション無効化
- ブラウザ非対応時のネイティブフォールバック（TanStack Router が自動処理）
- ユニットテストで `defaultViewTransition: true` が設定されていることを担保
- e2e ユースケースを更新

### やらないこと
- React experimental `<ViewTransition>` コンポーネントの採用（stable React 構成を崩すため）
- 個別要素単位の共有要素トランジション（`view-transition-name` morph 演出）
- slide / scale / 回転など大きなモーション
- 生の `.css` ファイル新設（MUI GlobalStyles で注入する既存構成に合わせる）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `createAppRouter` の `createRouter` 呼び出しに `defaultViewTransition: true` が設定されている
2. `AppRoot.tsx` の MUI `GlobalStyles` に `::view-transition-old(root)` / `::view-transition-new(root)` に 150〜200ms の fade CSS が定義されている
3. `@media (prefers-reduced-motion: reduce)` 内で `::view-transition-*` の `animation-duration: 0.01ms` または `none` が設定されている
4. `pnpm test` / `pnpm lint` が全緑
5. e2e usecases に「控えめな fade で画面が切り替わる」「reduced-motion 環境では瞬時遷移」の観察可能な期待動作が追記されている

注: fade アニメーションの見た目（opacity 変化）はブラウザ実行環境依存であり、jsdom ベースのユニットテスト対象外とする。ルータ設定の有無のみをユニットテストで担保する。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### router.tsx — `createRouter` に `defaultViewTransition: true` を追加
```ts
createRouter({
  routeTree,
  history: options.history,
  defaultPreload: "intent",
  defaultViewTransition: true,  // ← 追加
})
```

### AppRoot.tsx — MUI GlobalStyles でクロスフェード CSS を注入
`ThemeProvider` と `CssBaseline` の間に `GlobalStyles` を追加する。

```tsx
import GlobalStyles from "@mui/material/GlobalStyles";

<GlobalStyles styles={{
  "::view-transition-old(root), ::view-transition-new(root)": {
    animationDuration: "180ms",
    animationTimingFunction: "ease-out",
  },
  "::view-transition-old(root)": {
    animationName: "fade-out",
  },
  "::view-transition-new(root)": {
    animationName: "fade-in",
  },
  "@keyframes fade-out": {
    from: { opacity: 1 },
    to: { opacity: 0 },
  },
  "@keyframes fade-in": {
    from: { opacity: 0 },
    to: { opacity: 1 },
  },
  "@media (prefers-reduced-motion: reduce)": {
    "::view-transition-old(root), ::view-transition-new(root)": {
      animationDuration: "0.01ms",
    },
  },
}} />
```

### テスト（router.test.tsx に追記）
`createAppRouter` が返すルータのオプションに `defaultViewTransition: true` が含まれることを確認するユニットテストを追加する。

## 5. 影響範囲 / 既存への変更

| ワークスペース | ファイル | 変更内容 |
|--------------|---------|----------|
| client | `src/router.tsx` | `createRouter` に `defaultViewTransition: true` を追加 |
| client | `src/AppRoot.tsx` | `GlobalStyles` を追加（fade CSS + reduced-motion） |
| client | `src/router.test.tsx` | `defaultViewTransition` 設定の検証テストを追加 |
| e2e | `home-feed/usecases.md` / `usecases.md` | ビュー遷移のユースケースを追記 |

## 6. テスト計画（TDD で書くテスト一覧）

1. `createAppRouter()` が返すルータに `defaultViewTransition` オプションが `true` で設定されている
2. `createAppRouter({ history })` でオプション上書きしても `defaultViewTransition` が `true` のまま

## 7. リスク・未決事項

- **TanStack Router v1.87** の `defaultViewTransition` API が想定どおり動作するかは実環境のみ確認可能（jsdom では View Transitions API が未実装のためフォールバック）。ユニットテストはルータオプション設定の有無にとどめる。
- `#950`（スクロール位置復元）との干渉: TanStack Router の `scrollRestoration` は View Transition とは別レイヤーで動作するため基本的に競合しない。ブラウザ実環境で e2e 確認する。
