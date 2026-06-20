# 設計書: Claude API キーの管理を環境変数（ANTHROPIC_API_KEY）に一本化し、DB 永続化と管理画面の API トークン設定タブを廃止する (#662)

## 1. 目的 / 背景

現在 Claude API キーは (1) env `ANTHROPIC_API_KEY` と (2) DB `app_settings.CLAUDE_API_KEY`（暗号化）の 2 系統で管理されており、`getApiKey()` が DB 優先・env フォールバックで解決している。実運用では env（Cloud Run / Secret Manager）で注入されており DB 経由の設定は不要。二重管理を解消し env のみを正にする。

## 2. スコープ（やること / やらないこと）

**やること:**
- `runCommunityBatch` の API キー取得を `deps.anthropicApiKey`（env 値）の直接参照に変更
- `GET/PATCH /api/admin/settings` エンドポイントを削除
- 管理画面の「API トークン設定」タブを削除
- `AppSettingRepository` / `prismaAppSettingRepository` / `appSettingRepository.ts` を削除
- `common/src/domain/appSetting/` を削除
- `server/src/utils/crypto.ts` / `server/src/utils/apiKey.ts` を削除（AES 用途のみ廃止）
- `server/prisma/schema.prisma` から `AppSetting` モデルを削除し drop マイグレーションを追加
- OpenAPI baseline から `/api/admin/settings` 経路を削除
- e2e ユースケース（admin エリア）から「API トークン設定」関連を削除

**やらないこと:**
- `APP_SECRET` env の削除（セッション署名で引き続き使用）
- 他の管理画面タブ（ワーカー管理 / バッチログ / トークン使用量 / コミュニティ）の変更
- `ANTHROPIC_API_KEY` の空文字検証ロジックの変更（#450 対応済み）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `runCommunityBatch` の `RunCommunityBatchDeps` から `appSettingRepo` が削除されている
2. `runCommunityBatch` は `deps.anthropicApiKey` が未設定の場合スキップし、設定済みの場合に生成を実行する
3. `communityBatchIndex.ts` の `main()` が `appSettingRepo` を使わず `env.anthropicApiKey` を直接 `batchDeps.anthropicApiKey` に渡す
4. `GET /api/admin/settings` および `PATCH /api/admin/settings` が 404 を返す（ルートが存在しない）
5. `createAdminRouter` のシグネチャに `appSettingRepository` 引数が存在しない
6. `AppDeps` インターフェース（`app.ts`）に `appSettingRepository` が存在しない
7. 管理画面（SettingsScene）のタブに「API トークン設定」が含まれない
8. `SETTINGS_TAB_VALUES` に `"api-token"` が含まれない
9. `client/src/api/admin.ts` に `fetchSettings`・`patchSetting`・`useAdminSettings`・`useSaveAdminSetting` が存在しない
10. `common` パッケージから `AppSettingSchema`・`UpdateAppSettingSchema` がエクスポートされない
11. Prisma schema に `AppSetting` モデルが存在しない
12. OpenAPI baseline に `/api/admin/settings` の経路が存在しない
13. `pnpm turbo run build test lint` が全て緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### API キー取得の簡素化
```ts
// Before: getApiKey(deps.appSettingRepo, deps.anthropicApiKey)
// After:  deps.anthropicApiKey
```

`RunCommunityBatchDeps.appSettingRepo` を削除し、`getApiKey()` の呼び出しを `deps.anthropicApiKey` の直接使用に置き換える。

### 削除対象モジュール
- `server/src/utils/apiKey.ts` — DB 優先ロジックのみ、削除
- `server/src/utils/crypto.ts` — AES 暗号化 utility、削除
- `server/src/persistence/appSettingRepository.ts` — in-memory 実装含む、削除
- `server/src/persistence/prismaAppSettingRepository.ts` — Prisma 実装、削除
- `common/src/domain/appSetting/` — Zod スキーマ定義、削除

### 管理画面の変更
- `SETTINGS_TABS` 配列から `api-token` エントリを削除
- `SETTINGS_TAB_VALUES` から `"api-token"` を削除（タブ URL パラメータのユニオン型を更新）
- 関連コンポーネント（`ApiTokenSettingsInner`・`ApiTokenSettingsSkeleton`・`ApiTokenSettings`）を削除

### Prisma マイグレーション
- `app_settings` テーブルを drop するマイグレーションを手動作成

### OpenAPI baseline 更新
- `AppSettingResponse`・`UpdateAppSetting` schema コンポーネントを削除
- `/api/admin/settings` GET/PATCH パスを削除
- 変更後に `pnpm --filter @hatchery/server openapi` → baseline スナップショット更新

## 5. 影響範囲 / 既存への変更（対象ワークスペース）

| ワークスペース | 変更内容 |
|---|---|
| `server` | routes/admin.ts・batch/runCommunityBatch.ts・communityBatchIndex.ts・composition/createPrismaDeps.ts・app.ts・openapi/registrations/registerAdmin.ts・prisma schema・migration 追加 |
| `client` | routes/SettingsScene.tsx・routes/settingsTabValues.ts・api/admin.ts・mocks/data/fixtures.ts |
| `common` | domain/appSetting/ 削除・index.ts からエクスポート削除 |
| `docs` | fieldSpec/formSpecs.ts・settings-scene.mdx |
| `e2e` | admin/usecases.md |

## 6. テスト計画（TDD で書くテスト一覧）

1. `runCommunityBatch.test.ts` — `appSettingRepo` なしの deps で動作すること（typecheck レベル・既存テストを appSettingRepo なしで維持）
2. `admin.test.ts` — `GET/PATCH /api/admin/settings` が 404 を返すこと
3. `SettingsScene.test.tsx` — `api-token` タブが存在しないこと
4. `admin.ts` (client) — `fetchSettings`・`patchSetting` のテストを削除
5. `fixtures.test.ts` — `mockSettings` / `AppSettingResponse` テストを削除

## 7. リスク・未決事項

- **migration**: `app_settings` テーブルに本番データが残っている場合 drop で消えるが、API キーは env に移行済み想定のため問題なし
- **既存 tab URL**: `/admin?tab=api-token` に直接アクセスしたユーザーは最初のタブ（ワーカー管理）にフォールバックする（TanStack Router のデフォルト動作・許容範囲）
