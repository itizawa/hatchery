# Issue #484 設計書: 利用規約・プライバシーポリシーページを作成しサイドバーにメニューを追加する

## 背景・目的

Hatchery には利用規約・プライバシーポリシーのページが存在せず、サイドバーからもアクセスできない。
公開サービスとして最低限のリーガルページ（利用規約 / プライバシーポリシー）を SPA ルートとして用意し、
サイドバー下部からいつでも到達できるようにする。本 Issue の範囲は「ページ枠 + ドラフト文言」まで。
確定文言・法務レビュー・多言語・同意取得フローはスコープ外。

## 受け入れ条件 → 入出力

| # | 受け入れ条件 | 実装方針 |
|---|--------------|----------|
| 1 | 認証不要の公開ルート `/terms`・`/privacy` を `router.tsx` に追加し `routeTree` に登録 | `lpRoute`/`communitiesRoute` を雛形に `termsRoute`/`privacyRoute` を `createRoute` で定義し `addChildren` に追加。`beforeLoad` は付けない（公開） |
| 2 | 各シーン（`TermsScene.tsx`/`PrivacyScene.tsx`）を作成し、見出し + 章立てプレーンテキストを表示。本文は React 内静的保持・API 取得なし | `LandingScene.tsx` を雛形に、章配列を `const` で持つ presentational コンポーネント |
| 3 | 利用規約は「サービス概要 / 禁止事項 / 免責 / 規約変更 / 制定日」、プライバシーポリシーは「取得する情報 / 利用目的 / 第三者提供 / 問い合わせ / 制定日」の章立てを最低限含む。確定文言は運営者情報確定後に差し替える前提を本文 or コメントに明記 | 各 Scene にドラフト注記（コメント + 画面上の注意書き）を入れる |
| 4 | サイドバー（`SidebarContent`）下部に「利用規約」「プライバシーポリシー」リンクを追加。デスクトップ恒久サイドバー・モバイルドロワー双方で表示 | `SidebarContent` 末尾に Divider + `List`/`ListItemButton` を追加（共用なので両対応） |
| 5 | リンクは既存 `List`/`ListItemButton` + `RouterLink`（`to="/terms"`/`to="/privacy"`）パターンに従い `SLACK_COLORS.sidebarText` スタイルを踏襲 | 既存 admin リンクと同じ `sx={{ color: SLACK_COLORS.sidebarText }}` + `SIDEBAR_ICON_SX` |
| 6 | 両ページは認証なしで表示できる（`requireAuth` を付けない） | `beforeLoad` 無し。`isAuthLayout` にも追加しない（rootRoute 配下のサイドバー付きシェルで表示） |
| 7 | UI 部品は `components/uiParts` バレルから import。client → common の一方向 import 境界を守る。ユーザー入力フィールドは追加しない | `Box`/`Stack`/`Typography` 等を `../components/uiParts` から import。フォーム・入力なし |
| 8 | ルーティング・サイドバーリンク・各シーン描画を検証するテストを追加 | `router.test.tsx`（/terms・/privacy 描画 + 公開確認）、`RootLayout.test.tsx`（リンク存在 + href）、`TermsScene.test.tsx`/`PrivacyScene.test.tsx`（最小レンダリング） |
| 9 | `pnpm turbo run build test lint` が緑 | typecheck/lint/test をローカルで緑にする |

## 設計判断

- **レイアウト**: `/terms`・`/privacy` は rootRoute 配下のサイドバー付き通常シェルで表示する（`isAuthLayout` に追加しない）。Issue の「フッター的にサイドバー最下部へ配置」「rootRoute 配下で表示」の方針どおり。
- **静的本文**: 章は `ReadonlyArray<{ heading: string; body: string }>` の `const` で保持し `.map()` で描画。`LandingScene` の `FEATURES` パターンを踏襲。API・状態・フォームは一切持たない（純 presentational）。
- **ドラフト注記**: 各ページ冒頭に「本文は暫定ドラフトであり、運営者情報の確定後に正式な文言へ差し替える」旨を画面表示 + ファイル先頭コメントで明記（受け入れ条件 #3）。
- **制定日**: 暫定の制定日（2026-06-13）を最終章に表示。
- **サイドバー配置**: `SidebarContent` 末尾に Divider を 1 本追加し、その下に「利用規約 / プライバシーポリシー」リンクを置く。admin リンクのブロックとは別の `List` にして、admin 有無に関わらず常時表示する（全ユーザー参照可）。
- **アイコン**: `DescriptionIcon`（利用規約）・`PrivacyTipIcon`（プライバシーポリシー）を `@mui/icons-material` から直接 import（既存サイドバーが `HomeIcon` 等を直接 import しているのと同様）。
- **e2e**: ユーザー可視の新規画面のため、新エリア `legal` を `e2e/legal/` に新設（usecases.md + legal.spec.ts スケルトン）し、`e2e/usecases.md` 索引にエリア行とサマリを追加する。

## テスト計画（TDD）

1. `TermsScene.test.tsx` — 見出し「利用規約」、必須章（サービス概要 / 禁止事項 / 免責 / 規約変更 / 制定日）、ドラフト注記の表示。
2. `PrivacyScene.test.tsx` — 見出し「プライバシーポリシー」、必須章（取得する情報 / 利用目的 / 第三者提供 / 問い合わせ / 制定日）、ドラフト注記の表示。
3. `router.test.tsx` — `/terms`・`/privacy` で各見出しが描画され、未認証でもリダイレクトされない（公開）こと。
4. `RootLayout.test.tsx` — サイドバーに「利用規約」（href=/terms）・「プライバシーポリシー」（href=/privacy）リンクが、ログイン/未ログイン双方で表示されること。

## スコープ外

- 確定リーガル文言・法務レビュー。
- 多言語対応・バージョン管理・同意取得フロー。
