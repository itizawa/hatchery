# 設計書: 環境変数の直読み（ANTHROPIC_API_KEY / GCS_BUCKET_NAME 等）を config/env.ts に集約する (#419)

## 1. 目的 / 背景

`server/src/config/env.ts` の `EnvSchema`/`loadEnv` を通さない `process.env` 直読みが散在しており、設定項目の単一情報源が守られていない。起動時の Zod 検証を迂回し、設定ミスに気付くのが遅れる問題がある。

該当箇所:
- `server/src/utils/apiKey.ts:19` — `process.env.ANTHROPIC_API_KEY`
- `server/src/composition/createPrismaDeps.ts:28` — `process.env.GCS_BUCKET_NAME`

（`APP_SECRET` の `process.env` 直読みは `crypto.ts` に存在するが、本番必須化と合わせて #418 で対応するため本 Issue のスコープ外）

## 2. スコープ（やること / やらないこと）

**やること:**
- `ANTHROPIC_API_KEY`・`GCS_BUCKET_NAME` を `EnvSchema`/`ServerEnv` に追加
- `apiKey.ts` の `getApiKey` を「フォールバックキー」引数を受け取る形に変更（`process.env` 直読み廃止）
- `createPrismaDeps` に `gcsBucketName?` 引数を追加（`process.env` 直読み廃止）
- `runCommunityBatch` の `RunCommunityBatchDeps` に `anthropicApiKey?` を追加して `getApiKey` へ渡す
- `server.ts` / `communityBatchIndex.ts` を loadEnv 経由の値を渡す形に更新
- `env.test.ts` に新 env 項目のテストを追加
- `apiKey.test.ts` を新シグネチャに対応するよう更新

**やらないこと:**
- `APP_SECRET` の集約（→ #418）
- `NODE_ENV` の集約（慣例的に許容）
- client 側 env の変更
- ランタイムロジックの変更

## 3. 受け入れ条件（テストに落とせる粒度）

1. `ServerEnv` に `anthropicApiKey: string | undefined` と `gcsBucketName: string | undefined` が追加されている
2. `loadEnv({ ANTHROPIC_API_KEY: "sk-xxx" })` → `env.anthropicApiKey === "sk-xxx"`
3. `loadEnv({ GCS_BUCKET_NAME: "my-bucket" })` → `env.gcsBucketName === "my-bucket"`
4. `loadEnv({})` → 両方 `undefined`
5. `getApiKey(repo, "sk-env-key")` — DB に CLAUDE_API_KEY がない場合は第2引数を返す
6. `getApiKey(repo, undefined)` — DB に CLAUDE_API_KEY がない場合は `undefined` を返す
7. `getApiKey(repo, "sk-env-key")` — DB の値が優先される
8. `createPrismaDeps(prisma, "my-bucket")` → GcsStorageService が使われる
9. `createPrismaDeps(prisma, undefined)` → InMemoryStorageService が使われる
10. `server/src` 配下（`config/env.ts` と NODE_ENV 分岐を除く）に `process.env.<個別変数>` の直読みが残っていない

## 4. 設計方針

### `apiKey.ts` の変更

```typescript
// Before
export async function getApiKey(
  appSettingRepository: AppSettingRepository,
): Promise<string | undefined>

// After
export async function getApiKey(
  appSettingRepository: AppSettingRepository,
  anthropicApiKey?: string,
): Promise<string | undefined>
```

フォールバック先を `process.env.ANTHROPIC_API_KEY` から引数 `anthropicApiKey` に変えるだけ。インターフェース変更は最小限。

### `createPrismaDeps.ts` の変更

```typescript
// Before
export function createPrismaDeps(prisma: PrismaClient): Omit<AppDeps, "security" | "sessionStore">

// After
export function createPrismaDeps(prisma: PrismaClient, gcsBucketName?: string): Omit<AppDeps, "security" | "sessionStore">
```

### `runCommunityBatch.ts` の変更

`RunCommunityBatchDeps` に `anthropicApiKey?: string` を追加し、`getApiKey(deps.appSettingRepo, deps.anthropicApiKey)` に変更。

### `communityBatchIndex.ts` の変更

`main()` 内で `loadEnv()` を呼んで `env.anthropicApiKey` を取得し、`batchDeps.anthropicApiKey` に渡す。

## 5. 影響範囲 / 既存への変更

- `server/src/config/env.ts` — `ServerEnv` 型 + `EnvSchema` + `loadEnv` の拡張
- `server/src/utils/apiKey.ts` — シグネチャ変更（後方互換: 第2引数省略可 = optional）
- `server/src/utils/apiKey.test.ts` — 既存テストを新シグネチャに対応
- `server/src/composition/createPrismaDeps.ts` — シグネチャ変更
- `server/src/batch/runCommunityBatch.ts` — `RunCommunityBatchDeps` に `anthropicApiKey?` 追加
- `server/src/server.ts` — `createPrismaDeps(prisma, env.gcsBucketName)` に変更
- `server/src/batch/communityBatchIndex.ts` — `main()` で env を読んで `anthropicApiKey` を渡す
- `server/src/config/env.test.ts` — 新 env 項目のテスト追加

## 6. テスト計画（TDDで書くテスト一覧）

### `env.test.ts` に追加するテスト
- `ANTHROPIC_API_KEY` が設定されている場合 `env.anthropicApiKey` として返す
- `ANTHROPIC_API_KEY` 未設定なら `anthropicApiKey` が `undefined`
- `GCS_BUCKET_NAME` が設定されている場合 `env.gcsBucketName` として返す
- `GCS_BUCKET_NAME` 未設定なら `gcsBucketName` が `undefined`

### `apiKey.test.ts` の更新
- 第2引数に env キーを渡すと DB 未設定時にそれが返る
- 第2引数 `undefined` の場合 DB 未設定なら `undefined` が返る
- DB の値が第2引数より優先される
- DB が復号不能のとき第2引数にフォールバックする

### `createPrismaDeps.test.ts`（新規）
- `gcsBucketName` あり → `GcsStorageService` が使われる
- `gcsBucketName` なし → `InMemoryStorageService` が使われる

## 7. リスク・未決事項

- `createPrismaDeps.ts` に現状テストがないため、新しくテストを追加する（ストレージサービスの種類を検証）
- `runCommunityBatch.test.ts` の既存テストは `anthropicApiKey` を渡していないが、`RunCommunityBatchDeps` の新フィールドは optional のため後方互換維持（既存テストは変更不要）
