# 設計書: Hatchery を PWA 対応する (#797)

## 1. 目的 / 背景

Hatchery は Vite + React 19 SPA（ADR-0003）・Cloudflare Pages 静的ホスト（ADR-0008）構成。
Web App Manifest・Service Worker を追加し、スマホ/PC でインストール可能な PWA にする。
現状は manifest・theme-color・Service Worker が無く、PWA インストール基準を満たしていない。

## 2. スコープ（やること / やらないこと）

### やること
- `vite-plugin-pwa`（Workbox）を devDependency として client に追加
- PWA 用 PNG アイコン（192x192、512x512・maskable）を `client/public/` に追加
- Web App Manifest 設定（name/short_name/display/theme_color/icons 等）を `vite.config.ts` に追加
- ビルド時に `<link rel="manifest">` と `<meta name="theme-color">` が index.html に注入される
- Service Worker（Workbox）でアプリシェル（HTML/JS/CSS）をキャッシュ、ナビゲーションフォールバック → index.html
- Vitest テストで manifest 設定の必須フィールドを検証
- e2e ユースケース追加

### やらないこと
- Web Push 通知・バックグラウンド同期
- 投稿/コメントのオフラインデータキャッシュ
- アプリ更新通知 UI
- server / common への変更

## 3. 受け入れ条件（テストに落とせる粒度）

1. `PWA_MANIFEST_CONFIG.name === 'Hatchery'`
2. `PWA_MANIFEST_CONFIG.short_name` が定義されている
3. `PWA_MANIFEST_CONFIG.display === 'standalone'`
4. `PWA_MANIFEST_CONFIG.start_url === '/'`
5. `PWA_MANIFEST_CONFIG.scope === '/'`
6. `PWA_MANIFEST_CONFIG.theme_color` が定義されている（`#1164A3`）
7. `PWA_MANIFEST_CONFIG.background_color` が定義されている（`#F6F7F8`）
8. `PWA_MANIFEST_CONFIG.icons` に 192x192 PNG エントリが存在する
9. `PWA_MANIFEST_CONFIG.icons` に 512x512 PNG エントリが存在する
10. `PWA_MANIFEST_CONFIG.icons` の少なくとも 1 つに `purpose: 'maskable'` が含まれる
11. `pnpm turbo run build test lint` が緑

## 4. 設計方針

### ライブラリ選定
`vite-plugin-pwa`（0.21.x / Workbox）を採用。理由:
- Vite 6 公式サポート
- Workbox によるアプリシェルの自動 precache + navigateFallback 設定が1行
- devOptions.enabled=false（デフォルト）で `pnpm dev` 時に SW を登録しない
- ビルド時に manifest.webmanifest と sw.js を `dist/web/` に出力（コミット対象外）

### manifest 設定の管理
`vite.config.ts` に `export const PWA_MANIFEST_CONFIG` を追加して設定を外出しし、
`vite.config.test.ts` からインポートして必須フィールドをユニットテストで検証する。

### アイコン生成
`client/public/` に PNG アイコン（192x192、512x512）をソースファイルとして追加。
Node.js 標準の `zlib`（deflate）と PNG バイナリ形式で生成スクリプトを実行してコミット。
アイコン色は Slack テーマのプライマリブルー（R=17, G=100, B=163 = #1164A3）。

### テーマカラー
- `theme_color`: `#1164A3`（プライマリブルー、MUI ライトテーマのアクセント色）
- `background_color`: `#F6F7F8`（メイン領域背景色）

### Service Worker
`registerType: 'autoUpdate'`（SW 更新時に自動再読み込み）。
Workbox `navigateFallback: '/index.html'` で SPA のルーティングを保証。

### stg/prod 切替
favicon は `faviconHtmlPlugin` で切り替え済み。PWA manifest のアイコンは stg/prod 共通（本 Issue スコープ外）。

## 5. 影響範囲

- `client/`: `package.json`、`vite.config.ts`、`vite.config.test.ts`、`public/` のみ
- `docs/`: `e2e/pwa/usecases.md`（新規）、`e2e/usecases.md`（索引更新）
- `server/`・`common/`: 変更なし

## 6. テスト計画（TDD）

`vite.config.test.ts` に `PWA_MANIFEST_CONFIG` の必須フィールドを検証するテストを追加:
- name / short_name / description
- display / start_url / scope
- theme_color / background_color
- icons: 192x192 エントリあり
- icons: 512x512 エントリあり
- icons: maskable 目的エントリあり

## 7. リスク・未決事項

- `vite-plugin-pwa` は `defineConfig` from `vitest/config` 環境下でビルド時のみ SW 生成を行うため、test 実行に影響しない（devOptions.enabled=false がデフォルト）
- Cloudflare Pages の `_headers` / `_redirects` と SW の干渉は今回スコープ外
- PNG アイコンはソリッドカラー（ブランドブルー）のプレースホルダ。将来的に本格的なアイコンデザインに差し替え可
