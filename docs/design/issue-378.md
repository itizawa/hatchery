# 設計書: Issue #378 — userRepository・worldStateRepository・batchRunLogRepository（インメモリ実装）のテスト追加

## 背景・目的

`server/src/persistence/` のインメモリ実装のうち、`userRepository` / `worldStateRepository` / `batchRunLogRepository` の 3 つは単体テストを持たない。CRUD・検索・状態更新の基本分岐を網羅する単体テストを追加し、DB（Prisma）非依存で回帰を検出できるようにする。

Issue: #378（test）

## スコープ

- 追加するファイル（テストのみ。プロダクションコードは変更しない）:
  - `server/src/persistence/userRepository.test.ts`
  - `server/src/persistence/worldStateRepository.test.ts`
  - `server/src/persistence/batchRunLogRepository.test.ts`
- スコープ外: `prisma*Repository.ts`（実 DB 実装）のテスト（別 Issue 候補）。

## テスト設計（受け入れ条件 → 入出力）

参照実装: `subscriptionRepository.test.ts` / `tokenUsageLogRepository.test.ts`（インメモリ実装テストの型）。

### userRepository.test.ts（`createInMemoryUserRepository` / `createTestUserRepository`）

| ケース | 入力 | 期待出力 |
|---|---|---|
| findById ヒット | 初期ユーザー u1 を注入し `findById("u1")` | u1 を返す |
| findById ミス | `findById("missing")` | `null` |
| findByLoginId ヒット | `findByLoginId("login1")` | 該当ユーザー |
| findByLoginId ミス | `findByLoginId("missing")` | `null` |
| create → 取得 | `create({loginId, displayName, passwordHash})` | `id = loginId`・`role = "member"`・`avatarUrl = null` が付与され、`findByLoginId` で取得できる |
| create 重複 | 同一 loginId で 2 回 `create` | `LoginIdAlreadyExistsError` をスロー |
| updateProfile 更新 | `updateProfile(id, {displayName, avatarUrl})` | 更新後ユーザーを返し、`findById` にも反映 |
| updateProfile avatarUrl 省略 | `avatarUrl` を渡さない | 既存の avatarUrl を維持 |
| updateProfile 不存在 | `updateProfile("missing", ...)` | `Error` をスロー |
| createTestUserRepository | 既定 / `role: "member"` 指定 | `testuser` が取得でき role が反映、パスワードは bcrypt で `testpass` に一致 |

### worldStateRepository.test.ts（`createInMemoryWorldStateRepository`）

| ケース | 入力 | 期待出力 |
|---|---|---|
| 未保存時の get | `get()` | `null` |
| upsert → get | `upsert({summaryVersion, workerStates})` | `id = "singleton"`・`updatedAt: Date` が付与され `get()` に反映 |
| upsert 上書き | 2 回 `upsert` | 後の値で上書きされ、レコードは 1 件（singleton） |
| 防御的コピー | `get()` の戻り値を変更 | 内部状態に影響しない（再 `get()` は元の値） |

### batchRunLogRepository.test.ts（`createInMemoryBatchRunLogRepository`）

| ケース | 入力 | 期待出力 |
|---|---|---|
| create | `create({status, messageCount, errorMessage, errorCode})` | `id`・`executedAt: Date` が付与され入力値を保持 |
| failure ログ | `status: "failure"` + errorMessage/errorCode | そのまま保持 |
| findRecent 空 | ログ未登録で `findRecent(10)` | `[]` |
| findRecent 降順 + limit | 3 件 create → `findRecent(2)` | executedAt 降順（同時刻は挿入の新しい順）で 2 件 |

## 設計判断

- **テストのみで完結**（受け入れ条件 1〜2）。3 リポジトリの現仕様（公開メソッドのシグネチャ・戻り値型）をそのまま表現し、プロダクションコードは変更しない。
- 入出力は common の `BatchRunLog` / `WorldState` 型・`UserRole` に整合させる。`server → common` の一方向 import 境界を維持（テストは server 内のモジュールと vitest のみ import）。
- `executedAt` の降順検証は同一時刻になり得るため、挿入順 tie-break（実装仕様「同一時刻は挿入順（新しい順）」）を識別可能な `messageCount` で検証する。

## テスト・検証

- `pnpm --filter @hatchery/server test` 緑
- `pnpm turbo run build test lint` 緑
