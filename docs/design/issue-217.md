# 設計書: 管理画面のユーザー一覧で新規のEmployeeを追加できる (#217)

## 1. 目的 / 背景

管理画面（/admin → ユーザー一覧タブ）に「追加ボタン」を配置し、モーダルから新規の AI 社員（Employee、isBot=true）を追加できるようにする。
現状の EmployeeTable は DEFAULT_EMPLOYEES を presentational に表示するのみで、動的な追加機能がない。

## 2. スコープ（やること / やらないこと）

**やること**
- `common`: `CreateEmployeeSchema` / `CreateEmployeeInput` を追加（displayName・role・personality のバリデーション）
- `server`: `POST /api/admin/employees` エンドポイントを追加（admin 専用・認証必須）
- `server/persistence`: `EmployeeRepository.create()` メソッドを追加
- `server/openapi`: `POST /api/admin/employees` の OpenAPI 定義を追加
- `client`: `AddEmployeeDialog` コンポーネント（useForm + モーダル）を新規作成
- `client`: `EmployeeTable` を SettingsScene の ユーザー一覧タブで DB から取得したデータを表示する形に変更、追加ボタンを配置
- `client/api/admin.ts` に `useAdminEmployees` / `useCreateAdminEmployee` フックを追加

**やらないこと**
- Employee の削除・編集（別 Issue で対応）
- isBot=false（人間ユーザー）の Employee 作成（管理画面のユーザー一覧は AI 社員対象）
- CSV 一括インポートなどの高度な機能

## 3. 受け入れ条件（テストに落とせる粒度）

### サーバー側
1. `POST /api/admin/employees` が admin ロールで認証済みの場合 201 と作成した Employee を返す
2. `POST /api/admin/employees` が未認証の場合 401 を返す
3. `POST /api/admin/employees` が member ロールの場合 403 を返す
4. `POST /api/admin/employees` の displayName が空なら 400 を返す
5. `POST /api/admin/employees` の displayName が 51 文字以上なら 400 を返す
6. `POST /api/admin/employees` で作成した Employee は isBot=true になる

### クライアント側
7. EmployeeTable（管理画面用）に「社員を追加」ボタンが存在する
8. 「社員を追加」ボタンをクリックするとモーダルが開く
9. displayName フィールドが存在し、入力できる
10. role フィールドが存在し、入力できる（任意）
11. displayName が空のまま送信しようとするとエラーメッセージが表示される
12. 送信成功後にモーダルが閉じ、一覧が再取得される

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### common: CreateEmployeeSchema

```typescript
export const CreateEmployeeSchema = z.object({
  displayName: z.string().min(1).max(EMPLOYEE_DISPLAY_NAME_MAX_LENGTH),
  role: z.string().min(1).max(EMPLOYEE_ROLE_MAX_LENGTH).optional(),
  personality: z.string().max(500).optional(),
});
export type CreateEmployeeInput = z.infer<typeof CreateEmployeeSchema>;
```

isBot は常に true として server 側で付与するため、リクエストには含めない。

### server: POST /api/admin/employees

- `/api/admin` ルーターに追加（`requireAuth + requireAdmin` で保護済み）
- `EmployeeRepository.create(input)` を呼び出す
- id は `crypto.randomUUID()` で生成（server 側で付与）
- isBot は常に true

#### EmployeeRepository.create 追加

```typescript
create(input: { displayName: string; role?: string; personality?: string }): Promise<EmployeeRecord>;
```

### client: AddEmployeeDialog

- `@tanstack/react-form` の `useForm` を使用（useState によるフォーム管理禁止）
- フィールド: displayName（必須・max50）、role（任意・max50）
- `useCreateAdminEmployee` mutation を呼び出す
- 成功後: モーダルを閉じ + フォームリセット + queryInvalidate

### client: EmployeeTable の変更

- SettingsScene から `<EmployeeTable />` を使用する部分を `<AdminEmployeeTable />` に変更
- `AdminEmployeeTable` は DB から isBot=true の全 Employee を取得して表示
- GET エンドポイントは既存の `GET /api/admin/employees` を活用（未実装なら `GET /api/employees` を代用）

> 補足: 既存の `GET /api/employees` は isBot=true のみ返すため、管理画面のリストとして流用できる。admin 専用エンドポイント（/api/admin/employees GET）の追加は本 Issue のスコープ外とし、既存の `/api/employees` を使う。

### client: API フック

```typescript
// GET /api/employees（既存を流用）
export function useAdminEmployeeList() { ... }

// POST /api/admin/employees（新規）
export function useCreateAdminEmployee() { ... }
```

## 5. OpenAPI 追加パス

```
POST /api/admin/employees
  body: CreateEmployee（displayName: required, role?: string, personality?: string）
  response 201: Employee
  response 400: Error（バリデーションエラー）
  response 401: Error（未認証）
  response 403: Error（admin 権限なし）
```

## 6. テスト戦略

- **server**: `routes/admin.test.ts` に `POST /api/admin/employees` のテストを追加（TDD）
- **common**: `CreateEmployeeSchema` のバリデーションテストを `employee.test.ts` に追加（TDD）
- **client**: `AddEmployeeDialog.test.tsx` を新規作成（モーダルの表示・フォーム動作・送信を検証）
- **client**: `EmployeeTable.test.tsx` の既存テストが壊れないことを確認

## 7. 実装順序（TDD）

1. common: `CreateEmployeeSchema` テスト → 実装
2. server: `EmployeeRepository.create` テスト → 実装
3. server: `POST /api/admin/employees` テスト → 実装
4. server: OpenAPI 定義更新 → openapi.json 再生成 → client 型再生成
5. client: `AddEmployeeDialog` テスト → 実装
6. client: `AdminEmployeeTable` コンポーネント実装（SettingsScene から呼び出し変更）
