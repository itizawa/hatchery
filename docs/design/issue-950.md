# 設計書: 画面遷移時にスクロール位置が復元されない修正 (#950)

## 1. 目的 / 背景

`<Box component="main">` の `overflow: auto` で構成された内部スクロールコンテナは `window` スクロールではないため、TanStack Router のデフォルト（`scrollRestoration` 無効）では戻る/進む時にスクロール位置が保存・復元されない。また `scrollRestoration: true` にしても、対象が `window` のみになるため内部 div には作用しない。

## 2. スコープ（やること / やらないこと）

### やること

- `createAppRouter` に `scrollRestoration: true` を追加する
- `createAppRouter` に `scrollToTopSelectors` を追加し、前方遷移時に main 要素を先頭へ戻す
- `RootLayout` の `<Box component="main">` に `data-scroll-restoration-id="main-content"` を付与する
- e2e ユースケースを追記する

### やらないこと

- `useElementScrollRestoration` フックの使用（v1.170 では `data-scroll-restoration-id` + `scrollRestoration: true` で自動処理される）
- `AuthLayout`（サイドバー無し・スクロール領域なし）配下の画面の対応
- サーバー側・`common` / `server` ワークスペースへの変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `createAppRouter()` が返すルータの `options.scrollRestoration` が `true`
2. `createAppRouter({ history })` でも `options.scrollRestoration === true` が維持される
3. `createAppRouter()` が返すルータの `options.scrollToTopSelectors` が `'[data-scroll-restoration-id="main-content"]'` を含む
4. ホームルート（`/`）描画時、`<main>` 要素に `data-scroll-restoration-id="main-content"` 属性が付与されている
5. `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### TanStack Router v1.170 のスクロール復元機構

- `scrollRestoration: true` をルータオプションに設定すると、`setupScrollRestoration` が呼ばれ document のスクロールイベントをキャプチャフェーズで監視し始める。
- スクロールイベントの対象要素が `data-scroll-restoration-id` 属性を持つ場合、`[data-scroll-restoration-id="main-content"]` をキーにして位置を sessionStorage へ保存する。
- ルート変更後の `onRendered` イベントで保存済みの scroll 位置を `element.scrollTop` として復元する。
- `scrollToTopSelectors` を指定すると、前方遷移時（`shouldResetScroll=true`）に当該要素のスクロール位置コピーをスキップし、代わりに `element.scrollTo({ top: 0 })` を呼ぶ。これにより前方遷移 → 先頭・後退遷移 → 元の位置、という UX が実現する。

### 変更ファイル

| ファイル | 変更内容 |
|----------|----------|
| `client/src/router.tsx` | `createRouter` に `scrollRestoration: true` と `scrollToTopSelectors` を追加 |
| `client/src/routes/RootLayout.tsx` | `<Box component="main">` に `data-scroll-restoration-id="main-content"` を追加 |
| `client/src/router.test.tsx` | スクロール復元設定の検証テストを追加 |
| `e2e/home-feed/usecases.md` | UC-HOME-33・UC-HOME-34 を追記 |
| `e2e/usecases.md` | home-feed のサマリにスクロール復元を追記 |

## 5. 影響範囲 / 既存への変更

- **`client` のみ**。`common` / `server` への変更なし。
- `ScrollToTopButton` は `mainRef.current.scrollTop` を参照しており、スクロール復元とは別の機構なので競合しない（スクロール復元は TanStack Router が `element.scrollTop = savedY` を直接セットし、ScrollToTopButton はユーザークリックで `scrollTo({ top: 0 })` を呼ぶ）。
- ハッシュスクロール（`PostThreadScene` のコメントスクロール）は `location.hash` が存在する場合 TanStack Router がハッシュ優先で処理するため競合しない。

## 6. テスト計画（TDDで書くテスト一覧）

`client/src/router.test.tsx` に追記（`describe("スクロール復元（#950）")`）:

1. `createAppRouter()` が返すルータに `scrollRestoration: true` が設定されている
2. `history` オプションを渡しても `scrollRestoration: true` が維持される
3. `createAppRouter()` が返すルータに `scrollToTopSelectors` が `main-content` を含む
4. ホームルート（`/`）描画時、`<main data-scroll-restoration-id="main-content">` 要素が存在する

## 7. リスク・未決事項

- TanStack Router v1.170 の自動スクロール復元は `onRendered` で動作するため、`<Suspense>` の fallback が解決する前に main 要素の `scrollTop` がセットされる場合がある。コンテンツが非同期ロード中でも main 要素自体は常にマウントされているため影響は軽微と判断する。
- `sessionStorage` 上の保存量は最大 5MB だがキー数に比例するため、長期利用ユーザーでストレージが溢れた場合は保存失敗のみ（UI クラッシュなし）で許容範囲とみなす。
