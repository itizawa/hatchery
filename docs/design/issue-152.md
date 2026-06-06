# 設計書: Claude API トークンを DB に永続化し定時バッチが使うよう配線する (#152)

## 1. 目的 / 背景

管理画面から保存した Claude API トークンを DB に暗号化永続化し、定時バッチがその DB のトークンを実際に使って AI を動かすところまでをエンドツーエンドで成立させる。

現状の問題:
- `PrismaAppSettingRepository` が未実装（`InMemoryAppSettingRepository` のみ）→ 再起動で消える
- `server.ts` で `appSettingRepository` が Prisma 実装で注入されていない（InMemory フォールバック）
- `planningBatch.ts` が `process.env.ANTHROPIC_API_KEY` を直読みしており `getApiKey()` を使っていない

## 2. スコープ（やること / やらないこと）

### やること
- `PrismaAppSettingRepository` を実装する（`AppSettingRepository` IF に準拠）
- `server.ts` の composition root に `PrismaAppSettingRepository` を注入する
- `planningBatch.ts` を `getApiKey()` 経由で API キーを取得するよう修正する

### やらないこと
- トークン使用量の記録・表示（#153 で対応）
- admin/member ロール（#136 が既に実装済みのため確認のみ）
- 暗号化ロジックの変更（既存の `crypto.ts` をそのまま利用）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `PrismaAppSettingRepository.findAll()` が Prisma の `appSetting.findMany()` を呼び `AppSetting[]` を返す
2. `PrismaAppSettingRepository.findByKey(key)` が `appSetting.findUnique()` を呼ぶ（存在しない場合 null）
3. `PrismaAppSettingRepository.upsert(key, value)` が `appSetting.upsert()` を呼んで設定を保存・更新する
4. `server.ts` が `PrismaAppSettingRepository` を注入して `createApp` に渡す
5. `planningBatch` が `getApiKey(appSettingRepo)` 経由で API キーを取得する
   - DB に値があれば復号して使う
   - DB に値がなければ `process.env.ANTHROPIC_API_KEY` にフォールバックする
   - 両方未設定ならスキップする

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### `PrismaAppSettingRepository`
- `server/src/persistence/prismaAppSettingRepository.ts` に新規作成
- `PrismaClient` を constructor injection で受け取る
- `prismaBatchRunLogRepository.ts` の命名・構造パターンに倣う
- Prisma の `AppSetting` モデルは `key String @id`・`value String`・`updatedAt DateTime @updatedAt`

### `server.ts` の修正
- `import { PrismaAppSettingRepository } from "./persistence/prismaAppSettingRepository.js"` を追加
- `createApp` の引数に `appSettingRepository: new PrismaAppSettingRepository(prisma)` を追加

### `planningBatch.ts` の修正
- `runPlanningBatch` の冒頭で `const apiKey = await getApiKey(deps.appSettingRepo)` に変更
- `getApiKey` は `utils/apiKey.ts` に移動し、`admin.ts` と `planningBatch.ts` の両方から import する

## 5. 影響範囲 / 既存への変更

- `server/src/persistence/prismaAppSettingRepository.ts` — 新規作成
- `server/src/utils/apiKey.ts` — 新規作成（`getApiKey` を `admin.ts` から分離）
- `server/src/routes/admin.ts` — `getApiKey` を `utils/apiKey.ts` から re-export
- `server/src/server.ts` — `PrismaAppSettingRepository` の import と注入を追加
- `server/src/batch/planningBatch.ts` — `apiKey` の取得方法を `getApiKey()` 経由に変更
- `server/src/batch/planningBatch.test.ts` — DB キー優先のテストケースを追加

## 6. テスト計画（TDDで書くテスト一覧）

### `prismaAppSettingRepository.test.ts`（新規）
- `findAll`: Prisma モックで `findMany` 呼び出しを確認、返値を AppSetting[] に変換
- `findByKey`: `findUnique` 呼び出しを確認、存在する場合・しない場合
- `upsert`: `upsert` 呼び出しを確認、新規作成・更新の両ケース

### `planningBatch.test.ts`（修正）
- DB にキーがある場合: `findByKey` が暗号化値を返す → `getApiKey` が復号して使う（= `process.env` は不要）
- DB にキーがない場合: `findByKey` が null → env フォールバック
- 両方未設定: `findByKey` が null + env も未設定 → スキップ

## 7. リスク・未決事項

- `getApiKey` を `utils/apiKey.ts` に分離することで `admin.ts` と `planningBatch.ts` の両方から利用可能にし、routes → batch の依存を回避
- 暗号化 key（`APP_SECRET` 環境変数）が未設定の場合の挙動は既存 `crypto.ts` に依存（既実装済み）
