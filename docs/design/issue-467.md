# Issue #467 設計書: `AuthLayout.tsx` の RTL テストを追加する

## 背景・目的

`client/src/routes/AuthLayout.tsx` に対応する `*.test.tsx` が存在せず、client の他 route（`RootLayout` 等）が RTL テストを持つ中でテスト未整備だった。`AuthLayout` の描画契約を RTL テストで固定し、回帰を防ぐ。

## 現状の正確な把握（Issue 受け入れ条件との差分）

Issue 本文は `AuthLayout` を「未ログイン時に `/login` へリダイレクトする認証ガード Layout」と説明しているが、**現行コードではこれは成立しない**。事実関係:

- `AuthLayout.tsx` は `<Outlet />` のみを返す **サイドバーなしの LP 専用レイアウト**（`/lp` 用）であり、認証ガードではない（`router.tsx` の `isAuthLayout(pathname) === "/lp"` 分岐、`LandingScene.tsx` のコメント参照）。
- 認証ガード（未ログイン時のリダイレクト）は **#454 でログインがモーダル化**された結果、`router.tsx` の `requireAuth` / `requireAdminRoute`（各保護ルートの `beforeLoad`）が担う。リダイレクト先は `/login` ではなく `/?login=1`（公開ホーム上にログインモーダルを開く）。
- `/login` ルート自体も #454 で実体を廃止し、`/?login=1` へリダイレクトするだけの後方互換ルートになっている。
- 認証ガードの分岐（未ログインでのリダイレクト・admin ガード・公開ページの非リダイレクト）は既に `client/src/router.test.tsx` の「認証ガード（未ログイン時のリダイレクト）」で網羅済み。

このため、Issue の受け入れ条件 2/3/4 を**字面どおり**（`/login` への遷移・Skeleton ローディング等）に実装すると、存在しない振る舞いをテストすることになり実装と乖離する。Dark Factory の方針（実装と乖離させない・既存テストと重複させない）に従い、**受け入れ条件を現行 `AuthLayout` の実契約へ忠実に翻訳**してテスト化する。

## 受け入れ条件 → テストへの翻訳

| Issue 受け入れ条件 | 本 PR での対応 |
|---|---|
| 1. `AuthLayout.test.tsx` を追加 | 追加する（`client/src/routes/AuthLayout.test.tsx`） |
| 2. 未認証で `/login` へリダイレクト | 実体なし（#454 で `requireAuth` が `/?login=1` モーダルへ誘導）。**翻訳**: 「`AuthLayout` 自体は認証状態に依存せず Outlet を描画する（ガードではない）」ことを固定し、リダイレクトガードは `router.test.tsx` が担う旨をコメントで明記 |
| 3. 認証済みで子（Outlet）が描画される | **採用**: `AuthLayout` 配下の子ルート要素（Outlet）が描画されることを検証 |
| 4. ローディング中の表示 | **翻訳**: AuthLayout は自前のローディング UI を持たない（純粋に Outlet）。子の遅延描画時に Suspense フォールバックが表示され、解決後に子が描画されることを検証 |
| 5. 既存 route テストと同じユーティリティ・モック方針 | **採用**: `RootLayout.test.tsx` と同じ `createRootRoute`/`createRoute`/`createMemoryHistory` + `QueryClientProvider` + `vi.stubGlobal("fetch", ...)` 方針に揃える |
| 6. `pnpm turbo run build test lint` 緑 | 達成する |

## テスト設計（`client/src/routes/AuthLayout.test.tsx`）

`RootLayout.test.tsx` の `renderWithRouter` パターンを踏襲し、`AuthLayout` を子ルート（Outlet あり）にマウントする最小ルータを memory history で構築する。

1. **子（Outlet）を描画する**: `AuthLayout` 配下の子ルートのコンテンツが表示される。
2. **サイドバーを描画しない**: `AuthLayout` は `RootLayout` と異なりサイドバー（`role=navigation name=サイドバー`）を持たない（LP 専用レイアウトの識別契約）。
3. **認証状態に依存しない（ガードではない）**: 未認証（`/auth/me` 401）でも子（Outlet）をそのまま描画し、リダイレクトしない。リダイレクトガードは `requireAuth`（`router.test.tsx`）の責務である旨をコメントで明示。
4. **遅延する子の Suspense フォールバック**: 子要素が Suspense で遅延する場合、解決前はフォールバック、解決後は子が描画される。

サイドバー描画に依存しないが、`RootLayout.test.tsx` に倣い `window.matchMedia` / `fetch` をスタブして jsdom 由来のエラーを避ける。

## スコープ外

- e2e ユースケースの更新は不要（ユーザー可視の振る舞いは不変。テスト追加のみ）。
- 認証フローの e2e は #426 で別途扱う。
- `AuthLayout.tsx` 本体の実装変更はしない（テスト追加のみ）。
