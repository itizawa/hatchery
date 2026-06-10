# 設計書: 生成済み OpenAPI を Swagger UI / Redoc で配信し、API 仕様を常時閲覧できるようにする (#106)

## 1. 目的 / 背景

ADR-0006 / #8 / #41 により、`common` の Zod スキーマから `server/src/openapi/registry.ts` の
`generateOpenApiDocument()` で OpenAPI ドキュメントを生成できる。だが生成物 `openapi.json` は
client 型生成専用のビルド成果物（`.gitignore` 済み）で、人間が API 仕様を閲覧できる URL が無い。

本 Issue は、その生成 OpenAPI を**そのまま閲覧 UI として配信**し、Zod を単一情報源としたまま
常に最新の API 仕様をブラウザで見られる状態を作る。手書きの API 一覧は作らない。

## 2. スコープ（やること / やらないこと）

### やること
- `server` に API 仕様閲覧用ルーターを追加する。
  - `GET /openapi.json` … 生成済み OpenAPI ドキュメントの生 JSON を返す。
  - `GET /api-docs` … Redoc の HTML ページを返し、上記 `/openapi.json` を読み込んで描画する。
- 本番公開トグル（`ENABLE_API_DOCS`）を実装する。既定は dev のみ有効。
  `NODE_ENV=production` かつ無効時は両ルートを登録せず 404 にする。
- ルートテスト（200 で返る・主要パスが含まれる・本番無効時は 404）を追加する。

### やらないこと
- 個別エンドポイントの新規追加・仕様変更（registry の内容をそのまま配信するだけ）。
- 認証付き API 仕様（OAuth スコープ表示等）の作り込み。
- client 画面 URL 一覧（#105 で別対応）。
- docs/Storybook（GitHub Pages）側への静的 Redoc 同梱（Issue 本文でも任意・別 Issue 可）。

## 3. 受け入れ条件（テストに落とせる粒度）

- AC1: `GET /api-docs` が 200 を返し、`text/html` で Redoc を読み込む HTML を返す。
- AC2: `GET /openapi.json` が 200・`application/json` で OpenAPI ドキュメントを返し、
  `openapi`（"3.1.0"）と `paths` を含み、registry 登録済みの主要パス
  （例 `/api/communities`）が含まれる。
- AC3: 配信内容は `generateOpenApiDocument()`（registry）から得たもので、手書き仕様を持たない。
- AC4: 本番無効時（`NODE_ENV=production` かつ `ENABLE_API_DOCS` 未設定/偽）は
  `GET /api-docs`・`GET /openapi.json` がともに 404。
- AC5: dev（`NODE_ENV !== "production"`）では既定で有効、また `ENABLE_API_DOCS=true` なら本番でも有効。
- AC6: `turbo run lint test build` 相当が緑。

## 4. 設計方針

### 採用ライブラリ・配信方式の判断
- **Redoc を採用**（Issue 推奨どおり。読み物として見やすく、npm 依存も増やさない）。
  `swagger-ui-express` のような新規 npm 依存は追加せず、Redoc の standalone スクリプトを
  CDN から読み込む**自己完結 HTML** を server から返す。これにより `package.json` を汚さず、
  バンドルサイズも増えない。
- **配信方式は「起動時（リクエスト時）にメモリ上で生成」**。`generateOpenApiDocument()` を
  そのまま呼び、ファイル（gitignore 済み `openapi.json`）には依存しない。registry を単一情報源として
  常に最新を返せる（生成は軽量＝純粋関数なので都度生成で十分）。

### 有効/無効判定（トグル）
新規ヘルパ `isApiDocsEnabled(env)` を `routes/apiDocs.ts` に置く。
- `ENABLE_API_DOCS` が `"true"`/`"1"` → 有効。
- `ENABLE_API_DOCS` が `"false"`/`"0"` → 無効。
- 未設定 → `NODE_ENV !== "production"` のとき有効（dev 既定 ON / 本番既定 OFF）。

`createApp` では `isApiDocsEnabled(process.env)` が真のときだけ apiDocs ルーターを `app.use` する。
無効時はルート未登録＝Express の既定で 404 になる。

### ルーター
`createApiDocsRouter()` を新設し、`/openapi.json`（生 JSON）と `/api-docs`（Redoc HTML）を提供。
Redoc HTML は `<redoc spec-url="/openapi.json">` と standalone スクリプトを含む静的文字列。

## 5. 影響範囲 / 既存への変更

- `server/src/routes/apiDocs.ts`（新規）… ルーター + `isApiDocsEnabled`。
- `server/src/routes/apiDocs.test.ts`（新規）… ルートテスト。
- `server/src/app.ts`（変更）… トグルが有効なときルーターを配線。
- client / common / docs への変更なし。

## 6. テスト計画（TDD）

`server/src/routes/apiDocs.test.ts`:
- `isApiDocsEnabled`: dev 既定 ON / 本番既定 OFF / `ENABLE_API_DOCS=true` で本番でも ON / `=false` で dev でも OFF。
- `createApp` 経由（dev）: `GET /openapi.json` → 200・openapi="3.1.0"・`/api/communities` を含む。
- `createApp` 経由（dev）: `GET /api-docs` → 200・`text/html`・本文に `redoc` を含む。
- `createApp` 経由（本番無効）: `/openapi.json`・`/api-docs` ともに 404。

## 7. リスク・未決事項
- Redoc を CDN 読み込みにするためオフライン環境では UI が描画されない。仕様 JSON 自体は
  `/openapi.json` で取得できるので影響は限定的（MVP では許容）。
- 本番公開は既定 OFF。dev デプロイ（#78）で見たい場合は `ENABLE_API_DOCS=true` を設定する。
