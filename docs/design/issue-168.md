# 設計書: API を /api プレフィックスに統一し dev proxy を自動追従にする (#168)

## 1. 目的 / 背景

現状、server の全 API ルータはトップレベル（`/auth`・`/channels` 等）にマウントされており、
Vite dev proxy は各パスを手動列挙している。新しいルータを追加するたびに proxy にもパスを足す必要があり、
追加漏れると Vite の SPA フォールバックに食われて JSON parse エラーが発生する。

恒久対応として全 API を `/api/*` 配下に統一し、Vite proxy を `/api` 一本化することで、
以後ルータを増やしても dev proxy を触らなくて済む構造にする。

## 2. スコープ（やること / やらないこと）

### やること

- `server/src/app.ts` の全 API ルータマウントを `/api` プレフィックス配下に移動
- `server/src/openapi/registry.ts` の全 `registerPath` の `path` に `/api` を付与
- `client/vite.config.ts` の dev proxy を `/api` 一本（＋任意で `/health`）に簡略化
- `client/src/api/*.ts` の `openApiClient` 呼び出しパスリテラルを `/api/...` に更新
- server の supertest テストのパスを `/api/...` に更新

### やらないこと

- `/health` への `/api` プレフィックス付与（インフラ慣習・監視設定に合わせて据え置き）
- API バージョニング（`/api/v1` 等）
- クライアント型生成（`openapi.gen.ts`）の手動更新（ビルド時に自動生成される）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `app.ts` の全 API ルータが `/api/auth`・`/api/messages`・`/api/channels`・`/api/employees`・`/api/admin/batch-logs`・`/api/admin`・`/api/invitations` にマウントされる
2. `/health` は `/api` 外のまま（`/health`）で動作する
3. server の supertest テストが `/api/...` パスで呼ぶと成功し、旧パス（`/auth/login` 等）は 404 を返す
4. `openapi/registry.ts` の全 `registerPath` で `path` が `/api/` プレフィックスを持つ（`/health` を除く）
5. `client/vite.config.ts` の proxy が `/api` 一本（個別パスの列挙なし）になる
6. `client/src/api/*.ts` の全 `openApiClient.GET/POST/PATCH/DELETE(...)` 呼び出しが `/api/...` パスを使う
7. 全サーバテスト緑 + lint 通過

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### ルータマウント変更（server/src/app.ts）

```
// Before
app.use("/auth", createAuthRouter(...));
app.use("/channels", createChannelsRouter(...));

// After
app.use("/api/auth", createAuthRouter(...));
app.use("/api/channels", createChannelsRouter(...));
```

`/health` は監視・Cloud Run ヘルスチェック慣習に従い `/api` 外に据え置く。

### OpenAPI パス変更（server/src/openapi/registry.ts）

`registerPath` の `path` フィールドに一律 `/api` プレフィックスを付与。
`/health` のみ除外。型の自動追従: registry の path を変えれば `openapi.gen.ts` の `paths` 型が変わり、
client の呼び出しリテラルは型で漏れを検知できる（ADR-0006）。

### Vite proxy 簡略化（client/vite.config.ts）

```typescript
// Before: 個別パス列挙
proxy: Object.fromEntries(
  ["/auth", "/health", "/messages", "/channels", "/employees", "/admin", "/invitations"].map(...)
)

// After: /api 一本
proxy: {
  "/api": "http://localhost:3000",
  "/health": "http://localhost:3000",
}
```

`/health` はクライアントから直接呼ばれないが、proxy に残しておいても問題なく、
開発時の疎通確認に便利なため据え置く。

### client API パス更新

`client/src/api/*.ts` 内の全 `openApiClient.METHOD("/xxx/...")` を `"/api/xxx/..."` に変更。
openapi.gen.ts はビルド時に生成されるため、型整合はビルド時に確認する。

## 5. 影響範囲 / 既存への変更

- `server/src/app.ts` — ルータマウントパスの変更
- `server/src/openapi/registry.ts` — 全 registerPath の path 更新
- `client/vite.config.ts` — proxy 設定の簡略化
- `client/src/api/auth.ts` — openApiClient 呼び出しパス更新
- `client/src/api/channels.ts` — 同上
- `client/src/api/admin.ts` — 同上
- `client/src/api/batchLogs.ts` — 同上
- `client/src/api/scenes.ts` — 同上
- `server/src/routes/*.test.ts`（9ファイル）— supertest リクエストパス更新
- `server/src/app.security.test.ts` — `/messages` 等のパス更新

## 6. テスト計画（TDDで書くテスト一覧）

### 既存テストの更新（パス変更）

- `server/src/routes/auth.test.ts` — `POST /api/auth/login` 等
- `server/src/routes/messages.test.ts` — `POST /api/messages` 等
- `server/src/routes/channels.test.ts` — `GET /api/channels` 等
- `server/src/routes/employees.test.ts` — `GET /api/employees` 等
- `server/src/routes/batch-logs.test.ts` — `GET /api/admin/batch-logs` 等
- `server/src/routes/admin.test.ts` — `GET /api/admin/settings` 等
- `server/src/routes/health.test.ts` — `GET /health`（変更なし）
- `server/src/routes/invitations.test.ts` — `GET /api/invitations` 等
- `server/src/routes/planning-issues.test.ts` — パス確認
- `server/src/app.security.test.ts` — `/health` は変更なし、`/messages` → `/api/messages`

## 7. リスク・未決事項

- **本番環境**: Cloud Run 側が `/api` プレフィックスで待ち受けるようになるため、デプロイ後に proxy/ルーティング設定の整合を確認が必要（本 Issue のスコープ内で `app.ts` を更新すれば OK）
- **`/health`**: 監視設定（Cloud Run ヘルスチェック）は `/health` を直接叩くため変更しない
- **型生成**: `openapi.gen.ts` は gitignore 済みでビルド時自動生成。CI では `pnpm turbo build` で再生成される
