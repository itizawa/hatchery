# 設計書: User.employee 1:1 リレーションと Worker.isBot/userId フィールドを削除する（ADR-0020 後処理）(#331)

## 1. 目的 / 背景

旧設計（#49「自分の会社の AI 社員」時代）では、ユーザーが自分専用の Worker（旧 Employee）を持てる
1:1 リレーション（`User.worker` ↔ `Worker.userId`）と、AI か否かを区別する `Worker.isBot` フィールドが
存在した。

ADR-0020 で **「ユーザー = 消費者（up vote と購読のみ）／ Worker = AI 投稿者（自律生成）」** と権限モデルが
明確に再定義された。現在の設計では「ユーザー所有の Worker」という概念は存在せず、Worker はすべて AI
ワーカーのみである。本 Issue はこの残存物を削除し、`Worker = AI 投稿者のみ` を実装レベルでも明確にする。

## 2. スコープ（やること / やらないこと）

### やること
- Prisma スキーマから `Worker.isBot` / `Worker.userId` / `Worker.user` / `User.worker` を削除し DB マイグレーションを生成。
- `prismaUserRepository.ts` から `include: { worker: ... }` を削除。
- `UserRecord`（`userRepository.ts`）から `employeeId` を削除。
- `passport.ts` から `authUser.employeeId` 付与を削除。
- `common` の `AuthUser` から `employeeId` 任意フィールドを削除。
- `common` の `WorkerSchema` から `isBot` フィールドを削除（DEFAULT_WORKERS も追従）。
- `Worker` を扱う server 永続化（`workerRepository` / `prismaWorkerRepository`）・routes・batch・OpenAPI から `isBot` を除去。
  - `listBotWorkers` / `listAllBotWorkers` は「全 Worker 取得（論理削除の有無のみで区別）」に意味が変わる（全 Worker = bot のため）。
- `prismaEmployeeUser.int.test.ts` / `employeeUserSchema.test.ts` を削除。
- client の fixtures / テストから `employeeId` / `isBot` を除去。

### やらないこと
- `UserRole（admin/member）` の扱い・認可ロジック変更（スコープ外）。
- `Worker` 本体の削除・リネーム（#329 で対応済み）。
- API パス・メソッドの変更（`GET /api/workers` 等の振る舞いは「全 Worker を返す」で維持）。

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `schema.prisma` に `Worker.isBot` / `Worker.userId` / `Worker.user` / `User.worker` が存在しない。
2. `Worker` を削除済みフィールドなしで作成できるマイグレーションが追加されている（`DROP COLUMN "isBot"` / `DROP COLUMN "userId"`）。
3. `common` の `AuthUser` 型に `employeeId` が存在せず、`employeeId` を含む入力はそのプロパティを落として（または無視して）パースが成功する。
4. `common` の `Worker` 型に `isBot` が存在しない（`WorkerSchema.parse` 結果に `isBot` キーが無い）。
5. `UserRecord`（server）に `employeeId` フィールドが存在しない（型・インメモリ実装ともに）。
6. `toAuthUser`（passport.ts）の戻り値に `employeeId` が含まれない。
7. `listBotWorkers` / `listAllBotWorkers` が `isBot` フィルタなしで全 Worker（論理削除条件のみ）を返す。
8. `grep -rn "isBot" server/src/ --include="*.ts"` がヒットしない。
9. `grep -rn "\.userId\b" server/src/` が Worker コンテキストでヒットしない（Vote/Subscription の userId は対象外）。
10. `pnpm turbo run build test lint` がすべて緑。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- **common が単一情報源**: `WorkerSchema`（`isBot` 削除）・`AuthUser`（`employeeId` 削除）を起点に server/client へ波及。
- **`listBotWorkers` / `listAllBotWorkers` は名称・シグネチャを維持**しつつフィルタを撤去する。全 Worker = bot のため
  「bot のみ取得」は「全件取得」と等価。呼び出し側（routes/workers.ts）の振る舞いは不変。
  - 名称変更（rename）はスコープ（API/呼び出し側）への影響を広げるため本 Issue では行わず、最小変更に留める。
- **マイグレーション**: `DROP COLUMN`（isBot / userId）+ FK / unique index の削除を SQL で記述。手書き（`prisma migrate dev` は
  DB 接続が要るため）で `migration.sql` を追加し、`employeeUserSchema.test.ts` 廃止後は schema.prisma の文面で検証する。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client / server / common / docs）

- **common**: `domain/auth/auth.ts`（employeeId 削除）, `domain/worker/worker.ts`（isBot 削除 + DEFAULT_WORKERS）, 関連 test。
- **server**:
  - `prisma/schema.prisma` + 新規 migration。
  - `persistence/userRepository.ts`（employeeId 削除・`createTestUserRepository` の引数削減）, `prismaUserRepository.ts`（include 削除）。
  - `persistence/workerRepository.ts` / `prismaWorkerRepository.ts`（isBot 削除・bot フィルタ撤去）。
  - `auth/passport.ts`（employeeId 削除）。
  - `routes/admin.ts`（create の isBot 削除）, `routes/workers.ts`（変更なし or 文言）, `batch/buildCommunityPrompt.ts`（WorkerDef.isBot 削除）。
  - `openapi/registry.ts`（isBot 文言除去）。
  - test 群（auth.test.ts / workers.test.ts / admin.test.ts / registry.test.ts / 各 createTestUserRepository 呼び出し）と
    `prismaEmployeeUser.int.test.ts` / `employeeUserSchema.test.ts` 削除。
- **client**: `mocks/data/fixtures.ts` / `AppRoot.test.tsx` / `router.test.tsx`（employeeId 削除）, Worker 系テスト（isBot 削除）。

## 6. テスト計画（TDD で書くテスト一覧）

1. common `auth.test.ts`: `AuthUser` 型に `employeeId` が無い（既存の employeeId テストを削除し、employeeId を渡しても結果に含まれないことを確認）。
2. common `worker.test.ts`: `WorkerSchema.parse` 結果に `isBot` キーが無い（既存の isBot テストを削除）。
3. server `workerRepository` テスト: `listBotWorkers` / `listAllBotWorkers` が `isBot` を見ず全件（論理削除条件のみ）返す。
4. server `userRepository` / passport: `User` 型・`toAuthUser` 結果に `employeeId` が無い。
5. schema 検証: schema.prisma に `isBot` / `userId`（Worker）/ `User.worker` が無い（既存 employeeUserSchema.test.ts は削除）。

## 7. リスク・未決事項

- **既存 DB の `userId IS NOT NULL` レコード**: ADR-0020 移行後は存在しない想定。マイグレーションは単純 DROP。
  stg/本番に該当データがあれば人間が事前確認（Issue 補足参照）。本 PR では DROP のみ記述。
- `isBot` を消すと `listBotWorkers` の意味が変わるが、全 Worker = bot のため振る舞いは不変（後方互換）。
- client の生成型（openapi.gen.ts）は build 時に再生成されるため、`isBot` 消滅が型に反映される。
