# 設計書: server のリポジトリ/アダプタをクラスから関数ファクトリ（関数 DI）に統一する（ADR 含む） (#288)

## 1. 目的 / 背景

server は層分離（routes → usecases → persistence[IF]）で構成され、ルート・usecase・バッチ本体は既に関数 DI（`createXxxRouter(repo)` / deps 引数注入）で配線済み。OOP が残るのは **永続化アダプタのクラス実装**（`InMemoryXxxRepository` / `PrismaXxxRepository`）と `SystemScheduler`、およびその生成箇所のみ。

本件は永続化アダプタ／スケジューラの実装スタイルを「クラス（`implements`）→ ポート型を返すファクトリ関数（クロージャ）」に統一し、関数 DI に一本化する**純粋リファクタ**（挙動・公開 API・型契約は不変）。ADR-0012（IoC コンテナ不採用・手動 DI 継続）とは矛盾しない（コンテナ導入ではなくスタイル決定）。新しい実装規約として ADR で記録する。

> 注: Issue 本文のアグリゲート列挙（message/channel/employee 等）は起票当時のもので、その後のリネーム（Employee→Worker、Channel→Community、Message→Post/Comment 等）で現状と差異がある。本設計は **現状の src に存在する全 Repository クラス + SystemScheduler** を対象とする（Issue の「全アダプタをファクトリ化」という意図に忠実に従う）。

## 2. スコープ（やること / やらないこと）

### やること

- 新規 ADR `docs/adr/0024-functional-repositories.md` を作成し `docs/adr/README.md` 一覧に追記。
- 現状 src の全 In-Memory / Prisma リポジトリ実装クラスをファクトリ関数へ変換（下記 12 アグリゲート）。
  - community / post / comment / subscription / vote / worldState / worker / appSetting / batchRunLog / invitationLink / tokenUsageLog / user
- `SystemScheduler`（`SchedulerPort`）→ `createSystemScheduler(): SchedulerPort`。
- `InMemoryUserRepository.createWithTestUser`（static）→ 独立した関数 `createTestUserRepository(...)`。
- 生成サイトの差し替え: `app.ts` / `composition/createPrismaDeps.ts` / `batch/communityBatchIndex.ts` / `batch/schedule.ts` / 全テスト / `index.ts`（公開 re-export）。

### やらないこと（スコープ外）

- ポートの `interface`（`XxxRepository` / `SchedulerPort`）の型・シグネチャ変更。
- 例外クラス（`LoginIdAlreadyExistsError` / `UserIdAlreadyExistsError` / common `AppError`）の関数化。
- `StorageService`（`GcsStorageService` / `InMemoryStorageService`）の変換 — 永続化リポジトリではなく外部サービスアダプタであり、Issue の受け入れ条件 #2・#8 の対象（`*Repository` / scheduler）外。本リファクタでは触らない。
- 入力型・record 型 interface（`CommunityRecord` / `MessageCreateInput` 等）の変更。
- Result/Either 化、composition root のさらなる集約、client / common の変更。

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. ADR `docs/adr/0024-functional-repositories.md` が存在し、決定 (a)〜(d) を明記。`docs/adr/README.md` 一覧に行が追加されている。
2. 12 アグリゲートの In-Memory / Prisma 実装が `createInMemoryXxx(...): XxxRepository` / `createPrismaXxx(prisma): XxxRepository` の関数ファクトリになっている（内部状態はクロージャに閉じる）。
3. `createSystemScheduler(): SchedulerPort` が存在する。
4. ポートの `interface`・利用側（routes/usecases/batch 本体）のシグネチャは不変。
5. 生成サイトが `create*` 呼び出しに差し替わっている。
6. 全テストの `new InMemoryX(` / `new PrismaX(` が `createInMemoryX(` / `createPrismaX(` に更新され、既存アサーションは原則不変のまま緑。
7. 例外クラス・record/入力型 interface は維持。
8. `pnpm turbo run build test lint`（server）が緑。`server/src`（テスト含む）から `class \w*Repository`（`implements XxxRepository` のクラス）と `new (InMemory|Prisma)\w*Repository(` が消えている。これを検査する規約テストが緑。

## 4. 設計方針

- **変換パターン**: `class InMemoryXxx implements XxxRepository { private state; constructor(seed){...} method(){...} }` を
  `export function createInMemoryXxx(seed = ...): XxxRepository { const state = ...; return { method() {...} }; }` に置換。
  - `this.state` → クロージャ変数。`private` フィールドはクロージャローカル変数になる。
  - メソッドは戻り値オブジェクトのプロパティに。`async` メソッドはそのまま `async` プロパティに。
- **Prisma 実装**: `constructor(prisma)` → `createPrismaXxx(prisma: PrismaClient): XxxRepository` の引数に。`toRecord` 等のモジュールレベル純粋関数はそのまま。
- **scheduler**: `createSystemScheduler()` が `scheduleDaily` を持つオブジェクトを返す。`startMessageBatchScheduler` の `?? new SystemScheduler()` → `?? createSystemScheduler()`。
- **user の static**: `InMemoryUserRepository.createWithTestUser(employeeId, role)` → `createTestUserRepository(employeeId, role): Promise<UserRepository>`（`createInMemoryUserRepository([seed])` を内部で使う）。
- **公開 API（`index.ts`）**: `InMemoryUserRepository` クラス export → `createInMemoryUserRepository` 関数 export、`PrismaUserRepository` → `createPrismaUserRepository`。これに合わせて `index.test.ts` を更新（公開シンボルが function であること）。
- 命名は Issue の例（`createInMemoryChannelRepository` / `createPrismaChannelRepository`）に倣い `createInMemoryXxxRepository` / `createPrismaXxxRepository` とする（既存クラス名 `InMemoryXxxRepository` の接頭辞を `create` 付与で踏襲）。

## 5. 影響範囲 / 既存への変更

- **対象ワークスペース: server のみ**（+ docs に ADR）。client / common は不変。
- 変更ファイル: `server/src/persistence/*.ts`（In-Memory / Prisma 各実装）、`server/src/batch/schedule.ts`、生成サイト（`app.ts` / `composition/createPrismaDeps.ts` / `batch/communityBatchIndex.ts`）、`index.ts`、全 `*.test.ts` の生成呼び出し、`docs/adr/0024-*.md`・`docs/adr/README.md`。
- 一方向 import 境界（server → common）は不変。

## 6. テスト計画（TDD で書くテスト一覧）

- **規約テスト（新規・TDD アンカー）** `server/src/persistence/functionalRepositories.convention.test.ts`:
  - `server/src` 配下（テスト含む）に `class \w+Repository\b ... implements` が存在しないこと（例外クラス `extends Error` は除外）。
  - `server/src` 配下に `new (InMemory|Prisma)\w*Repository(` が存在しないこと。
  - `new SystemScheduler(` が存在しないこと。
  - 各アグリゲートのモジュールが `createInMemoryXxxRepository` / `createPrismaXxxRepository` をエクスポートしていること（代表数件を import して `typeof === "function"` を確認）。
  - `createSystemScheduler` をエクスポートし `typeof === "function"`。
- **既存テスト（リグレッションのセーフティネット）**: 各 `*Repository.test.ts`・routes/batch テストはアサーション不変のまま、生成呼び出しのみ `create*` に更新して緑を維持する。

## 7. リスク・未決事項

- アグリゲート数が多く機械的変換が大量。`interface` 不変なので部分適用でも壊れず、既存テストが挙動を保証する。
- `createWithTestUser` の static → 関数化で呼び出し側（多数のテスト）を一括更新する必要がある。
- ADR 連番は既存最大（0023）の次として **0024** を採番。
