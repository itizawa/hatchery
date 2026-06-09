# Issue #218 設計書 — 管理画面でEmployeeを削除できる

## 目的

管理画面（ユーザー一覧タブ）に削除ボタンを設置し、確認モーダル付きで Employee を論理削除できるようにする。
これまでのメッセージは残し、削除済み社員の表示名は `【削除済み】田中 太郎` の形式で表示する。

## 受け入れ条件

1. 管理画面のユーザー一覧テーブルに削除ボタン（各行）が表示される
2. 削除ボタンを押すと確認モーダルが開く
3. 確認モーダルで「削除」を押すと Employee が論理削除される（`deletedAt` がセットされる）
4. 物理削除は行わない（メッセージ等の関連データは保持）
5. 論理削除済み Employee のメッセージ表示名が `【削除済み】<元の表示名>` となる
6. `DELETE /api/admin/employees/:id` エンドポイント（admin ロール必須）が実装される
7. 論理削除済み Employee は `GET /api/employees` の一覧から除外される
8. 論理削除済み Employee は `GET /api/admin/employees` の一覧でも除外（または別途フラグで取得可）

## アーキテクチャ決定

### DB: 論理削除フィールド追加

```prisma
model Employee {
  // ... 既存フィールド
  deletedAt DateTime?  // null=有効, 値=削除済み（論理削除・#218）
}
```

Prisma マイグレーションで `deletedAt` カラムを追加。

### サーバー側

1. **EmployeeRepository インターフェース**: `softDelete(id: string): Promise<EmployeeRecord | null>` を追加
2. **InMemoryEmployeeRepository**: `softDelete` を実装。`listBotEmployees` / `findById` は `deletedAt=null` でフィルタ
3. **PrismaEmployeeRepository**: `softDelete` を実装。既存クエリに `where: { deletedAt: null }` を追加
4. **EmployeeRecord**: `deletedAt: Date | null` フィールドを追加
5. **`DELETE /api/admin/employees/:id`**: requireAdmin で保護。`softDelete` を呼び出す。404/200 を返す
6. **OpenAPI registry**: DELETE エンドポイントを登録

### フロントエンド

1. **`client/src/api/admin.ts`**: `deleteEmployee(id)` 関数と `useDeleteEmployee` フック（useMutation）を追加
2. **`client/src/components/EmployeeTable.tsx`**: 削除ボタン列 + `DeleteEmployeeDialog` 確認モーダルを追加
   - `onDelete?: (id: string) => void` プロップ
   - `isDeleting?: boolean` プロップ（削除中は削除ボタンを無効化）
3. **`client/src/routes/SettingsScene.tsx`**: EmployeeTable に `onDelete`・`isDeleting` を渡す

### 表示名の論理削除プレフィックス

`common/src/domain/employee/employee.ts` の `createDisplayNameResolver` を改修。
`EmployeeRecord` に `deletedAt` フィールドを追加し、null でない場合は `【削除済み】` プレフィックスを付与する。

ただし、`createDisplayNameResolver` は `Employee` 型（common の Zod スキーマ型）を受け取るため、
`deletedAt` を `EmployeeSchema` に追加するか、別の解決関数を使うか検討する。

**方針**: サーバー側の `EmployeeRecord` に `deletedAt` を追加し、メッセージ表示の `createDisplayNameResolver`
は `Employee` 型ではなく `{ id: string, displayName: string, deletedAt?: Date | null }` を受け取るよう
オーバーロードする。

**シンプル案（採用）**: `formatEmployeeDisplayName(employee: { displayName: string; deletedAt?: Date | null }): string`
という純粋関数を common に追加し、表示時にプレフィックスを付与する。
`createDisplayNameResolver` も内部でこの関数を使うように改修する。

## ファイル変更一覧

| ファイル | 種別 |
|--------|------|
| `server/prisma/schema.prisma` | Employee に `deletedAt DateTime?` 追加 |
| `server/prisma/migrations/...` | マイグレーションファイル追加 |
| `common/src/domain/employee/employee.ts` | `formatEmployeeDisplayName` 追加 |
| `server/src/persistence/employeeRepository.ts` | `EmployeeRecord.deletedAt`, `softDelete` 追加 |
| `server/src/persistence/prismaEmployeeRepository.ts` | `softDelete`, 既存クエリに deletedAt フィルタ |
| `server/src/openapi/registry.ts` | DELETE エンドポイント登録 |
| `server/src/routes/admin.ts` | `DELETE /api/admin/employees/:id` 追加 |
| `server/src/app.ts` | adminRouter に employeeRepository を渡す |
| `client/src/api/admin.ts` | `deleteEmployee`, `useDeleteEmployee` 追加 |
| `client/src/components/EmployeeTable.tsx` | 削除ボタン + 確認ダイアログ追加 |
| `client/src/routes/SettingsScene.tsx` | EmployeeTable に削除機能を接続 |

## テスト方針

- **common**: `formatEmployeeDisplayName` の単体テスト
- **server/persistence**: `InMemoryEmployeeRepository.softDelete` テスト
- **server/routes**: `DELETE /api/admin/employees/:id` のルートテスト（admin 必須・404・200）
- **client/components**: EmployeeTable の削除ボタン・ダイアログのコンポーネントテスト
