# Issue #181 設計書: ワーカー表示名・役割・性格の admin 編集

## 目的

admin が **ワーカーの表示名（displayName）・役割（role）・性格（personality）を画面から編集できる**ようにする。

## 現状分析

### 既存実装の状態

- `PATCH /api/employees/:id` は実装済みだが「本人のみ更新可能」（`user.employeeId !== id` チェック）
- Issue #181 では**編集権限を admin に一本化**（ADR-0018 ピボット対応）
- common の `EmployeeSchema` / `UpdateEmployeeSchema` は既に `.max()` 制約付きで実装済み
  - `displayName`: `min(1).max(50)`
  - `role`: `min(1).max(50)`（optional）
  - `personality`: `max(500)`（optional）
- `requireAdmin` ミドルウェアは #136 で実装済み

### ブロッキング Issue 状況

- #304（common worker スキーマ刷新）・#305（server workers API 基盤）はまだオープン
- しかし **既存の Employee スキーマ・employees routes が受け入れ条件を満たせる実装**であるため、
  これらのブロックは「将来の刷新時に対応」という解釈で Issue #181 を完結できる

## 実装方針

### common

受け入れ条件の要求（`displayName`: min(1).max(50)、`role`: max(50)、`personality`: max(500)）は既に満たされている。
ただし Issue #181 の受け入れ条件として「50文字ちょうど→OK / 51文字→NG のテストを追加」が明示されているため、
`employee.test.ts` にテストケースを追加する。

### server

`PATCH /api/employees/:id` の認可ロジックを変更:
- **変更前**: `user.employeeId !== id`（本人チェック）
- **変更後**: `requireAdmin`（admin ロールのみ）

OpenAPI レジストリの説明文も更新（「自分の Employee」→「admin のみ」）。

### client

1. `client/src/api/employees.ts` に `useUpdateEmployee` mutation を追加
2. `client/src/components/EditEmployeeDialog.tsx` を新規作成（tanstack/react-form を使用）
3. `client/src/components/EmployeeTable.tsx` を拡張して編集ボタンと `EditEmployeeDialog` を組み込む
4. `SettingsScene.tsx` 内の `EmployeeTable` を `useBotEmployees` フックと連携して最新データを反映

## データフロー

```
openApiClient.PATCH("/api/employees/{id}", ...) 
  → server: requireAdmin → validateBody(UpdateEmployeeSchema) → employeeRepository.update()
  → 200: 更新後の Employee
```

## 各レイヤーの変更点

### common/src/domain/employee/employee.test.ts（追加）

- displayName 50文字ちょうど → OK
- displayName 51文字 → NG
- personality 500文字ちょうど → OK（既存スキーマで通るが明示）

### server/src/routes/employees.ts

- `PATCH /:id` の認可ロジック変更:
  - `if (user.employeeId !== id) { ... }` を削除
  - `requireAdmin` ミドルウェアを追加（`requireAuth` の後段）

### server/src/routes/employees.test.ts

- テストケース追加:
  1. 未認証 → 401
  2. admin 更新 → 200
  3. member 更新 → 403
  4. 不存在 → 404
  5. displayName 51文字 → 400

### server/src/openapi/registry.ts

- `PATCH /api/employees/{id}` の summary/responses を admin 権限に更新

### client/src/api/employees.ts

- `useUpdateEmployee` mutation を追加

### client/src/components/EditEmployeeDialog.tsx（新規）

- tanstack/react-form を使用
- displayName（maxLength: 50）、role（maxLength: 50）、personality（maxLength: 500）の入力
- 保存成功で一覧を invalidate

### client/src/components/EmployeeTable.tsx

- 編集ボタン列を追加
- `EditEmployeeDialog` を組み込む

## 上限値

| フィールド | 上限 | Zod | inputProps.maxLength |
|-----------|------|-----|---------------------|
| displayName | 50 | min(1).max(50) | 50 |
| role | 50 | .max(50) | 50 |
| personality | 500 | .max(500) | 500 |

## 依存関係

- `requireAdmin`: #136 で実装済み
- `UpdateEmployeeSchema`: common に実装済み
- `openApiClient`: ADR-0006 で実装済み
