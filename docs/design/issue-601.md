# Issue #601 設計書: stg 環境での favicon グレースケール化

## 背景・目的

stg 環境（develop / Cloudflare Pages の非 main 配信）と本番環境（main / hatchery-works.com）は UI がほぼ同一のため、ブラウザのタブだけでは「今どちらを開いているか」が判別できない。

`VITE_APP_ENV` というビルド時環境変数を導入し、stg ビルド時は favicon をグレースケール版（`favicon-stg.svg`）に差し替えることで、ブラウザタブを見るだけで stg / 本番を判別できる状態にする。

## 実装方針

### 1. グレースケール版 favicon の追加

`client/public/favicon-stg.svg` を新設する。
`favicon.svg` の青基調の色（`#1164A3`, `#5A9BD4`, `#26334D`）をグレースケールに変換する:
- `#26334D`（暗背景 / 口ドット）→ `#3D3D3D`（暗グレー）
- `#1164A3`（青プライマリ）→ `#666666`（中間グレー）
- `#5A9BD4`（青ライト）→ `#999999`（明るいグレー）
- `#FFFFFF`（目の白）→ そのまま `#FFFFFF`

SVG 構造（viewBox / shape-rendering / role / aria-label）は `favicon.svg` をそのまま踏襲する。

### 2. ビルド時 favicon 切り替えプラグイン

`client/vite.config.ts` に `faviconHtmlPlugin()` を追加する。
既存の `cfBeaconHtmlPlugin` / `ogpUrlHtmlPlugin` と同じ `transformIndexHtml` 方式を採用する。

- `VITE_APP_ENV === "stg"` のとき: `href="/favicon.svg"` → `href="/favicon-stg.svg"` に差し替え
- それ以外（`prod` / 未設定 / 空・空白のみ）: `href="/favicon.svg"` のまま（変更なし）

実装:
```typescript
export function faviconHtmlPlugin(): Plugin {
  return {
    name: "hatchery-favicon",
    transformIndexHtml(html) {
      const appEnv = process.env.VITE_APP_ENV?.trim();
      if (appEnv === "stg") {
        return html.replaceAll("/favicon.svg", "/favicon-stg.svg");
      }
      return html;
    },
  };
}
```

### 3. テスト

`client/vite.config.test.ts` に `faviconHtmlPlugin` のテストを追加する。
既存の `cfBeaconHtmlPlugin` テストと同形式（`runTransform` ヘルパー流用）で以下の 4 ケースを検証:

a. `VITE_APP_ENV=stg` → href が `/favicon-stg.svg` になる
b. `VITE_APP_ENV=prod` → `/favicon.svg` のまま
c. 未設定 → `/favicon.svg` のまま
d. 空白のみ → `/favicon.svg` のまま

### 4. デプロイワークフロー更新

- `deploy-client-dev.yml` の Build ステップ env に `VITE_APP_ENV: "stg"` を追加
- `deploy-client-prod.yml` は未設定のまま（本番は通常 favicon）

### 5. .env.example 更新

`VITE_APP_ENV` を `client/.env.example` にコメント付きで追記する。

## 受け入れ条件との対応

| # | 受け入れ条件 | 実装 |
|---|------------|------|
| 1 | グレースケール版 favicon を追加する | `client/public/favicon-stg.svg` 新設 |
| 2 | ビルド時に favicon を切り替えるプラグインを追加する | `faviconHtmlPlugin` を `vite.config.ts` に追加 |
| 3 | プラグインの単体テストを追加する | `vite.config.test.ts` に 4 ケース追加 |
| 4 | デプロイワークフローで env を注入する | `deploy-client-dev.yml` に `VITE_APP_ENV: "stg"` 追加 |
| 5 | ローカル `pnpm dev` でも従来どおり通常 favicon | 未設定時はフォールバックで `/favicon.svg` のまま |
| 6 | `pnpm turbo run build|test|lint` がすべて緑 | テスト・lint・typecheck で検証 |

## スコープ外

- タブタイトルへの `[STG]` プレフィックス付与は今回やらない
- e2e usecases.md 更新不要（本番 e2e では従来どおり通常 favicon、環境依存の振る舞いは e2e 対象外）
