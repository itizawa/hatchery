# Issue #220 設計書: 管理画面のEmployee一覧テーブルでEmployeeの画像を表示する

## 概要

管理画面（/admin）のユーザー一覧タブにある `EmployeeTable` に、各 Employee の画像（アバター）を表示する。

## 背景と依存

- Issue #204（ワーカー画像を admin がアップロード）に依存するとコメントにあるが、画像フィールド自体は先行して `EmployeeSchema` と `EmployeeRecord` に追加できる。
- 現時点では `Employee` / `EmployeeRecord` に `imageUrl` フィールドが存在しない。
- `imageUrl` が未設定の場合は `displayName` の先頭文字をイニシャルとして MUI `Avatar` でフォールバック表示する。

## 設計方針

### 1. common: EmployeeSchema への imageUrl 追加

`common/src/domain/employee/employee.ts` に `imageUrl` フィールドを追加する。

```typescript
imageUrl: z.string().url().max(EMPLOYEE_IMAGE_URL_MAX_LENGTH).optional(),
```

- `max()` を設定（#91 バリデーション規約遵守）。
- URL 形式のバリデーション（`z.string().url()`）。
- 任意フィールド（既存データ互換性保持）。

### 2. server: EmployeeRecord への imageUrl 追加

`server/src/persistence/employeeRepository.ts` の `EmployeeRecord` に `imageUrl` を追加する。

- `PrismaEmployeeRepository` でも `imageUrl` を返す（Prisma スキーマ変更は #204 の範囲のため、今回は DB カラムなし・常に `null` を返す）。
- **注**: DB への実際の保存は #204 で行う。本 Issue は表示層の実装に留める。

### 3. client: EmployeeTable での Avatar 表示

`EmployeeTable` の「表示名」列の前に「画像」列を追加する。

- `imageUrl` があれば画像を `<Avatar src={imageUrl} />` で表示。
- `imageUrl` がなければ `displayName[0]` を文字で表示（`<Avatar>{displayName[0]}</Avatar>`）。
- サイズは `size="small"` 相当（`width: 32, height: 32`）。
- isLoading のスケルトンも対応（`<Skeleton variant="circular" />`）。

### 4. server: OpenAPI レジストリへの imageUrl 追加

`server/src/openapi/registry.ts` の `EmployeeSchema` 登録に `imageUrl` を追加する。

## 受け入れ条件

1. `EmployeeTable` の列ヘッダに「画像」列がある
2. `imageUrl` が設定されている Employee は画像を `Avatar` で表示する
3. `imageUrl` が未設定の Employee はイニシャルの `Avatar` でフォールバック表示する
4. isLoading=true のとき画像列もスケルトン表示される
5. `EmployeeSchema` に `imageUrl: z.string().url().max(N).optional()` が追加されている
6. 全テスト緑・lint 通過

## 変更ファイル

- `common/src/domain/employee/employee.ts` — imageUrl フィールド追加
- `server/src/persistence/employeeRepository.ts` — EmployeeRecord に imageUrl 追加
- `server/src/persistence/prismaEmployeeRepository.ts` — imageUrl を常に null で返す
- `server/src/openapi/registry.ts` — EmployeeSchema に imageUrl 追加
- `client/src/components/EmployeeTable.tsx` — 画像列追加
- `client/src/components/EmployeeTable.test.tsx` — テスト追加

## TDD 手順

1. `EmployeeTable.test.tsx` に画像列のテストを追加（失敗）
2. コミット（test: #220 EmployeeTable画像列テスト追加）
3. `EmployeeTable.tsx` を修正して緑にする
4. common の `employee.test.ts` に imageUrl のテストを追加（失敗）
5. `employee.ts` を修正して緑にする
