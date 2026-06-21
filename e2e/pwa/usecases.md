# e2e ユースケース: PWA（インストール可能な Web アプリ）

このエリアは Hatchery の PWA 対応（Web App Manifest / Service Worker）に関する
ユーザー可視の振る舞いを記載します（#797）。

## 前提条件

- Hatchery の本番ビルド（`pnpm build`）が完了しており、`client/dist/web/` が存在する
- Cloudflare Pages または `vite preview` でアプリが配信されている状態

---

## UC-PWA-01: manifest リンクが HTML に含まれる

**対象画面**: 任意のページ（共通 `<head>`）

**ステップ**:
1. `https://hatchery.pages.dev/` にアクセスする
2. ページのソースを確認する（または DevTools で `<head>` を検査する）

**期待動作**:
- `<head>` 内に `<link rel="manifest">` タグが存在し、`manifest.webmanifest`（またはそれに準ずる URL）を参照している

---

## UC-PWA-02: theme-color メタタグが HTML に含まれる

**対象画面**: 任意のページ（共通 `<head>`）

**ステップ**:
1. `https://hatchery.pages.dev/` にアクセスする
2. DevTools で `<head>` の `<meta name="theme-color">` タグを確認する

**期待動作**:
- `<meta name="theme-color" content="#1164A3">` が存在し、ブラウザの UI クロームに Hatchery のプライマリブルーが反映される

---

## UC-PWA-03: Web App Manifest の内容が正しい

**対象画面**: manifest ファイル（`/manifest.webmanifest`）

**ステップ**:
1. `https://hatchery.pages.dev/manifest.webmanifest` に直接アクセスする

**期待動作**:
- JSON ファイルが返され、以下のフィールドを含む:
  - `name: "Hatchery"`
  - `display: "standalone"`
  - `start_url: "/"`
  - `theme_color: "#1164A3"`
  - `icons` に 192x192 と 512x512 の PNG エントリが存在し、いずれかに `purpose: "maskable"` が含まれる

---

## UC-PWA-04: PWA アイコンが配信される

**対象画面**: アイコンアセット

**ステップ**:
1. `https://hatchery.pages.dev/pwa-192x192.png` にアクセスする
2. `https://hatchery.pages.dev/pwa-512x512.png` にアクセスする

**期待動作**:
- どちらも HTTP 200 で PNG 画像が返される
- 既存の `/favicon.svg` は引き続き正常に配信される

---

## UC-PWA-05: Service Worker が登録されアプリシェルをキャッシュする

**対象画面**: 任意のページ（SW はグローバル）

**ステップ**:
1. Chrome / Safari でアプリを開く
2. DevTools → Application → Service Workers を確認する
3. ネットワークを「オフライン」に切り替えてページをリロードする

**期待動作**:
- Service Worker が `activated` 状態になっている
- オフラインでもアプリシェル（HTML/JS/CSS）が表示される（コンテンツは API 依存のため空表示でよい）
- ナビゲーション（URL 直打等）も `index.html` にフォールバックし 404 にならない

---

## UC-PWA-06: スマホ/PC でホーム画面に追加できる

**対象画面**: インストールプロンプト

**ステップ**:
1. Chrome（Android / デスクトップ）または Safari（iOS）でアプリを開く
2. アドレスバーのインストールアイコン（または「ホーム画面に追加」メニュー）を確認する

**期待動作**:
- インストールプロンプトが表示される（manifest と SW が正しく設定されているブラウザ基準を満たす）
- インストール後はスタンドアロン表示（ブラウザの UI なし）で起動できる
