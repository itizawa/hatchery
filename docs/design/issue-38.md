# 設計書: Employee を更新できるようにする（性格 personality の設定を含む） (#38)

## 1. 目的 / 背景

ログインユーザーが自分に紐づく Employee を更新できるようにする。
AI バッチ（#53）のプロンプト設計において、`personality` フィールドをキャラクター指針として利用するための基盤を整備する。

## 2. スコープ（やること / やらないこと）

### やること
- `common`: `EmployeeSchema` に `personality` フィールドを追加（任意・500 文字以内）
- `common`: `UpdateEmployeeSchema` / `UpdateEmployeeInput` 型を定義
- `server/prisma`: `Employee` モデルに `personality String?` カラム追加・マイグレーション
- `server`: `EmployeeRepository` インターフェース + `InMemoryEmployeeRepository` 実装
- `server`: `PrismaEmployeeRepository` 実装
- `server`: `PATCH /employees/:id` エンドポイント（認証必須・本人のみ）
- `server`: `app.ts` への employees ルーター登録
- `server`: OpenAPI スキーマへの追加

### やらないこと
- Employee の作成・削除（MVP スコープ外）
- 一覧取得 API（別 Issue）
- personality をプロンプトに組み込む実装（#53 スコープ）
- displayName / role 以外のフィールド追加（本 Issue の対象は personality のみ）

## 3. 受け入れ条件（テストに落とせる粒度）

1. `PATCH /employees/:id` は認証していないと 401 を返す
2. `PATCH /employees/:id` で他ユーザーの Employee を更新しようとすると 403 を返す
3. 自分の Employee を `PATCH /employees/:id` で更新すると 200 で更新後の Employee を返す
4. `personality` が 500 文字を超えると 400 を返す
5. `personality` が未設定（空文字・省略）でも更新できる
6. `displayName` / `role` は更新可能フィールドとする
7. `displayName` が空文字の場合は 400 を返す
8. common の `EmployeeSchema` に `personality` フィールドが追加されている
9. Prisma スキーマに `personality String?` がある
10. OpenAPI スキーマに `PATCH /employees/:id` が定義されている

## 4. 設計方針

### common 変更
`EmployeeSchema` に `personality: z.string().max(500).optional()` を追加する。
`UpdateEmployeeSchema` を新規定義（`displayName` / `role` / `personality` の部分更新）。

### 認可ロジック
`req.user.employeeId` と `params.id` を比較する。
`User` 型の `employeeId` はすでに定義済み（Issue #49）。

### リポジトリパターン
既存の `channelRepository.ts` パターンに倣い、`employeeRepository.ts` にインターフェースと `InMemoryEmployeeRepository` を定義。  
`prismaEmployeeRepository.ts` で Prisma 実装。

### app.ts への組み込み
`createApp` の `AppDeps` に `employeeRepository?: EmployeeRepository` を追加し、省略時はインメモリを使用。

## 5. 影響範囲

- `common/src/domain/employee/employee.ts` — `EmployeeSchema` / `UpdateEmployeeSchema` 追加
- `server/prisma/schema.prisma` — `Employee.personality` 追加
- `server/prisma/migrations/` — 新規マイグレーション
- `server/src/persistence/employeeRepository.ts` — 新規
- `server/src/persistence/prismaEmployeeRepository.ts` — 新規
- `server/src/routes/employees.ts` — 新規
- `server/src/routes/employees.test.ts` — 新規
- `server/src/app.ts` — employeeRepository 注入・ルーター登録
- `server/src/openapi/registry.ts` — エンドポイント追加

## 6. テスト計画（TDD で書くテスト一覧）

### common/src/domain/employee/employee.test.ts（追記）
- `personality` が 500 文字以内なら valid
- `personality` が 501 文字なら invalid

### server/src/persistence/employeeRepository.test.ts（新規）
- `InMemoryEmployeeRepository.findById`: 存在する Employee を返す
- `InMemoryEmployeeRepository.findById`: 存在しない場合は null を返す
- `InMemoryEmployeeRepository.update`: フィールドを更新して返す
- `InMemoryEmployeeRepository.update`: 存在しない場合は null を返す

### server/src/routes/employees.test.ts（新規）
- 未ログインで PATCH → 401
- 他ユーザーの Employee を PATCH → 403
- 自分の Employee を PATCH（personality 設定）→ 200 + 更新済み Employee
- `personality` 501 文字 → 400
- `displayName` 空文字 → 400
- `personality` 省略 → 200（他フィールドのみ更新）
- `role` のみ更新 → 200

## 7. リスク・未決事項

- `prisma generate` が worktree 内で実行できない場合は Prisma 型を直接使わずリポジトリ抽象を経由する（インメモリテストで対応）。
- 統合テスト（DATABASE_URL 必要）は `.int.test.ts` とし、DB なし CI ではスキップする。
