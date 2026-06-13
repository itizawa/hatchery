# @hatchery/client

Hatchery のフロントエンド。Vite + React 19 の SPA（SSR なし・ADR-0003）。ホスティングは Cloudflare Pages（ADR-0008）。

## 環境変数（ビルド時に注入）

`VITE_*` の環境変数はビルド時に JS バンドル / HTML へ静的に焼き込まれる。値を変えたら再ビルド（再デプロイ）が必要。

| 変数 | 用途 | 未設定時の挙動 |
|------|------|----------------|
| `VITE_API_BASE_URL` | server API のベース URL（オリジン）。クロスオリジン配信（Cloudflare Pages × Cloud Run）で Cloud Run の URL を渡す。 | 同一オリジン相対（`window.location.origin`）で API を呼ぶ。 |
| `VITE_LOG_LEVEL` | クライアントのログレベル（`debug`/`info`/`warn`/`error`）。 | `info`。 |
| `VITE_OGP_URL` | OGP（`og:url` / `og:image`）の本番ドメイン（#256）。 | `vite.config.ts` の既定ドメイン（`https://hatchery.pages.dev`）。 |
| `VITE_CF_BEACON_TOKEN` | Cloudflare Web Analytics のビーコントークン（ADR-0026 / #439）。 | ビーコン `<script>` を出力しない（アクセス計測は無効・no-op）。 |

## Cloudflare Web Analytics（アクセス計測・ADR-0026）

PV/UU と SPA ルート遷移を Cloudflare Web Analytics で計測する。**Cookie を使わないため GDPR 同意バナーは不要**（ADR-0026）。

### 仕組み

- `index.html` の `<head>` にプレースホルダ `%VITE_CF_BEACON_TOKEN_SCRIPT%` を置き、`vite.config.ts` の
  `cfBeaconHtmlPlugin` がビルド時に `VITE_CF_BEACON_TOKEN` を読んでビーコン `<script>` を注入する。
  トークン未設定（空・空白のみ）の場合は `<script>` を一切出力しない（壊れた空 token タグを残さない）。
- SPA は `<a>` のフルロードを伴わないため、TanStack Router の遷移完了（`onResolved`）を契機に
  `window.__cfBeacon.push({ type: "page" })` で page ビューを手動通知する（`src/analytics/`）。
  初回ロードはビーコン本体が自動計測するため除外し、二重計上を避ける。トークン未設定（`window.__cfBeacon`
  不在）では通知は no-op になり例外を投げない。

### デプロイ時の設定

1. Cloudflare ダッシュボードで対象 Pages プロジェクトの **Web Analytics を有効化**し、ビーコントークンを発行する（インフラ人手作業）。
2. 発行したトークンを CI のビルドステップに `VITE_CF_BEACON_TOKEN` として渡す
   （`.github/workflows/deploy-client-*.yml` の Build client ステップに env を追加する。
   トークンは GitHub Actions Secret 経由で渡し、コードにハードコードしない）。
3. 再デプロイすると本番 HTML にビーコンが焼き込まれ、計測が始まる。

トークン未発行のうちは未設定（no-op）のままで安全にビルド・デプロイできる。
