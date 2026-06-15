# 設計書: prismaUserRepository・prismaWorldStateRepository・prismaBatchRunLogRepository の実DB結合テスト追加 (#466)

## 1. 目的 / 背景

`server/src/persistence/` の Prisma 実装層のうち、以下 3 リポジトリに対応する `*.test.ts` が存在しない。他の Prisma 実装はすべて `describe.skipIf(!DATABASE_URL)` 形式の実DB結合テストを持つが、この 3 つだけ網羅の穴がある。

- `server/src/persistence/prismaUserRepository.ts`
- `server/src/persistence/prismaWorldStateRepository.ts`
- `server/src/persistence/prismaBatchRunLogRepository.ts`

## 2. スコープ（やること / やらないこと）

**やること:**
- 上記 3 ファイルに対応する `*.test.ts` を追加する
- 既存の `prismaWorkerRepository.test.ts` / `prismaTokenUsageLogRepository.test.ts` と同一パターンを踏襲する
- `DATABASE_URL` 未設定時にテストが `skip` されること

**やらないこと:**
- 実装ファイル（`.ts` 本体）の変更
- インメモリ実装（appSettingRepository等）のテスト（#425 のスコープ）

## 3. 受け入れ条件（テストに落とせる粒度）

1. `prismaUserRepository.test.ts`: `describe.skipIf(!DATABASE_URL)` で `create` / `findById` / `findByGoogleId` / `updateProfile`（成功・P2025 Not Found）/ role マッピングをカバー
2. `prismaWorldStateRepository.test.ts`: `describe.skipIf(!DATABASE_URL)` で `get`（存在しない場合 null）/ `upsert`（新規作成・更新）/ `workerStates` 往復（空・複数キー）をカバー
3. `prismaBatchRunLogRepository.test.ts`: `describe.skipIf(!DATABASE_URL)` で `create`（id/executedAt 自動付与・全フィールド正確保存）/ `findRecent`（件数上限・新しい順・空配列）をカバー
4. 既存テストと同一の `describe.skipIf(!DATABASE_URL)` パターン・命名規則に揃える
5. `pnpm turbo run build test lint` が緑。`DATABASE_URL` 未設定環境ではテストが `skip` される

## 4. 設計方針

- パターン: `prismaWorkerRepository.test.ts` / `prismaTokenUsageLogRepository.test.ts` を雛形とする
- 各テストファイルは `beforeAll` で PrismaClient 作成・接続、`afterAll` で切断、`afterEach` でテーブルをクリアする
- `prismaUserRepository`: User テーブルは FK 参照が存在する可能性があるため `afterEach` で `prisma.user.deleteMany()` を使用
- `prismaWorldStateRepository`: シングルトンなので `afterEach` で `prisma.worldState.deleteMany()` を使用
- `prismaBatchRunLogRepository`: `afterEach` で `prisma.batchRunLog.deleteMany()` を使用

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: `server/`
- 変更ファイル: テストファイル 3 件（新規追加のみ）
- 既存実装への変更: なし

## 6. テスト計画

### prismaUserRepository.test.ts
- `create`: 全フィールド正確に保存、role="member" がデフォルト
- `create`: 重複 googleId で `GoogleIdAlreadyExistsError` を throw
- `findById`: 存在する id でユーザーを返す
- `findById`: 存在しない id は null を返す
- `findByGoogleId`: 存在する googleId でユーザーを返す
- `findByGoogleId`: 存在しない googleId は null を返す
- `updateProfile`: displayName が反映される
- `updateProfile`: avatarUrl が反映される
- `updateProfile`: 存在しない id で `Error` を throw（P2025）

### prismaWorldStateRepository.test.ts
- `get`: WorldState が存在しない場合 null を返す
- `upsert`: 新規作成された WorldState を返す
- `upsert`: 既存の WorldState を更新する（summaryVersion が変わる）
- `workerStates` 往復: 空オブジェクトが保存・取得できる
- `workerStates` 往復: 複数キーのマップが保存・取得できる

### prismaBatchRunLogRepository.test.ts
- `create`: id と executedAt が自動付与される
- `create`: status="success" で全フィールドが正確に保存される
- `create`: status="failure" + errorMessage + errorCode が保存される
- `findRecent`: executedAt 降順で最大 limit 件取得する
- `findRecent`: limit より件数が少ない場合は全件返す
- `findRecent`: 空の場合は空配列を返す

## 7. リスク・未決事項

- `prismaUserRepository` の `afterEach: prisma.user.deleteMany()` で FK 制約違反が起きる場合は、参照テーブルを先にクリアする対応が必要（テスト DB が空であれば問題ない見込み）
- CI 環境で `DATABASE_URL` が設定されているかどうかで実テストが走るかが変わる（skip のみの PR になる可能性があるが、構造自体の価値がある）
