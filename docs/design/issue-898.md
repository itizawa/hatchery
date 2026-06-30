# 設計書: e2e/pwa の UC-PWA-01〜06 を Playwright テストとして実装する (#898)

## 1. 目的 / 背景

`e2e/pwa/pwa.spec.ts` の全 6 件が `test.todo()` のまま残存している。
PWA 機能（manifest リンク・アイコン配信・ServiceWorker 登録）を e2e テストで継続的にリグレッション検知できるようにする。

## 2. スコープ（やること / やらないこと）

**やること**
- UC-PWA-01: manifest リンクが HTML の `<head>` に存在し `manifest.webmanifest` を参照している
- UC-PWA-02: `<meta name="theme-color" content="#1164A3">` が HTML の `<head>` に存在する
- UC-PWA-03: `/manifest.webmanifest` が正しい JSON（name / display / start_url / theme_color / icons）を返す
- UC-PWA-04: `/pwa-192x192.png` と `/pwa-512x512.png` が HTTP 200 で PNG 画像を返す
- UC-PWA-05: `test.skip` で実装困難を明記（開発サーバーでは SW 無効のため）
- UC-PWA-06: `test.skip` で実装困難を明記（ブラウザ UI 依存のため自動化不可）

**やらないこと**
- SW のオフライン動作検証（プロダクションビルド + 別環境が必要）
- インストールプロンプトの自動操作（ブラウザ固有 UI のため不可）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. UC-PWA-01 が pass する: `page.goto('/')` 後に `link[rel="manifest"]` が `href` に `manifest.webmanifest` を含む
2. UC-PWA-02 が pass する: `meta[name="theme-color"]` の `content` が `#1164A3` である
3. UC-PWA-03 が pass する: `GET /manifest.webmanifest` が 200 を返し JSON に `name: "Hatchery"`, `display: "standalone"`, `start_url: "/"`, `theme_color: "#1164A3"`, 192x192 と 512x512 の icons（うち一方が `purpose: "maskable"` を含む）がある
4. UC-PWA-04 が pass する: `/pwa-192x192.png` と `/pwa-512x512.png` が 200 で `image/png` を返す
5. UC-PWA-05 が skip になる（実装困難を明記した `test.skip`）
6. UC-PWA-06 が skip になる（実装困難を明記した `test.skip`）
7. `pnpm turbo run test --filter=@hatchery/client` が緑（e2e は Vitest スコープ外だが、既存の Playwright 設定と整合している）

## 4. 設計方針

### テストの種別と実装可能性

| UC | 実装方法 | 実装可能 |
|----|---------|----------|
| PWA-01 | `page.goto('/')` → `link[rel="manifest"]` 属性検査 | ✅ |
| PWA-02 | `page.goto('/')` → `meta[name="theme-color"]` 属性検査 | ✅ |
| PWA-03 | `page.request.get('/manifest.webmanifest')` → JSON 検査 | ✅ |
| PWA-04 | `page.request.get('/pwa-192x192.png')` 等 → status/header 検査 | ✅ |
| PWA-05 | SW は dev サーバーで `devOptions.enabled: false` のため無効 | ❌ → skip |
| PWA-06 | `beforeinstallprompt` はブラウザ固有 UI、Playwright で自動制御不可 | ❌ → skip |

### API モックの方針

UC-PWA-01 / 02 は `page.goto('/')` でページを開く。
ページロード時に `/api/communities`（サイドバー）と `/api/auth/me`（認証状態）へのリクエストが発生するが、
`<head>` コンテンツは静的 HTML に含まれるため、API レスポンスを待たずに検査できる。
エラー抑制のため最小限のモックを設定する（not-found.spec.ts と同パターン）。

UC-PWA-03 / 04 は `page.request.get()` を使うため、ページ遷移・API モック不要。

## 5. 影響範囲 / 既存への変更

- **変更ファイル**: `e2e/pwa/pwa.spec.ts` のみ（`test.todo()` → 実装）
- **変更なし**: `e2e/pwa/usecases.md`（定義は既に整合している）

## 6. テスト計画

- `pwa.spec.ts` に UC-PWA-01〜04 の実テスト、UC-PWA-05〜06 の `test.skip` を実装
- `pnpm e2e --grep="UC-PWA"` でローカル実行して確認

## 7. リスク・未決事項

- UC-PWA-01 / 03: `vite-plugin-pwa` が dev サーバーでも manifest を inject するかは動作確認が必要。
  `devOptions.enabled: false` は SW を無効化するが、manifest リンク injection は VitePWA v0.17+ で dev でも有効。
  もし dev サーバーでは manifest が serve されない場合は `test.skip` に変更する。
- `manifest.webmanifest` の Content-Type ヘッダーは Vite の静的ファイルサーバーが自動設定する。
