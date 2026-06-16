# Issue #595 設計書: CommunitiesTab 共通フィールド抽出

## 背景・目的

`CommunitiesTab.tsx`（412行・client最大のコンポーネント）にて、`CreateCommunityForm` と `EditCommunityForm` の両方で `name`/`description`/`generationInstruction` のフォームフィールド定義（`form.Field` + `TextField` のブロック）がほぼ完全にコピーされていた。

目的は共通フィールドを小コンポーネントとして抽出し、作成/編集で共有して重複を解消すること。

## 受け入れ条件と実装方針

### 1. 共通フィールド群コンポーネント `CommunityFormFields` の抽出

`name`/`description`/`generationInstruction` の 3 フィールドを `CommunityFormFields` コンポーネントに抽出し、`CreateCommunityForm` / `EditCommunityForm` の両方から利用する。

**参照実装**: `EditWorkerDialog` / `AddWorkerDialog` が共有する `WorkerCommunitiesField`（同パターンの抽出例）に倣い、`client/src/components/CommunityFormFields.tsx` として新規ファイルに切り出す。

**コンポーネントの設計**:
- `@tanstack/react-form` の `FieldApi` 型を受け取るのではなく、`value` と `onChange` と `onBlur` と `error` / `helperText` を props で受け取る形にする
- ただし、Issue の要件が「form.Field に委ねる」であるため、`CommunityFormFields` は `form` オブジェクト（または form.Field の各props群）を受け取り、内部で `form.Field` を呼び出す
- `@tanstack/react-form` の `useForm` が返す `form` オブジェクトを型引数付きで受け取れるように `ReactFormExtendedApi` 型を活用する

**実装上の選択**: `@tanstack/react-form` の型システムとの整合性を保つため、`form` オブジェクト自体を props として渡す設計を採用する。これにより:
- `form.Field` は引き続き `CommunityFormFields` の内部で呼び出される
- バリデータや `field.state` へのアクセスも変わらず型安全

### 2. フォーム規約遵守 (#262)

フォーム状態管理は引き続き `@tanstack/react-form` の `useForm` / `form.Field` に委ねる。`CommunityFormFields` は `form` の各フィールドをレンダリングするだけで、状態を自前管理しない。

### 3. 既存テスト維持・ユーザー可視挙動不変

`CommunitiesTab.test.tsx` のテストはリファクタリング前後で全て通過する必要がある。UI上の見た目・ラベル・バリデーションエラーメッセージ・maxLength属性は一切変えない。

### 4. ビルド・テスト・lint 緑

`pnpm turbo run build test lint` が全緑。

## ファイル構成

- **新規**: `client/src/components/CommunityFormFields.tsx`
  - `name`/`description`/`generationInstruction` の 3 フィールドを描画するコンポーネント
- **変更**: `client/src/components/CommunitiesTab.tsx`
  - `CreateCommunityForm` と `EditCommunityForm` から重複フィールド定義を削除し、`CommunityFormFields` を呼び出す

## 型設計

`@tanstack/react-form` では `form.Field` は `form` オブジェクトのメソッドとして呼び出すため、`form` を props として受け取る方針が最もシンプル。

```tsx
// CommunityFormFields の props 型のイメージ
interface CommunityFormFieldsProps<TFormData extends { name: string; description: string; generationInstruction?: string | null }> {
  form: ReactFormExtendedApi<TFormData, ...>;
}
```

ただし `ReactFormExtendedApi` の型引数が複雑なため、`CreateCommunityInput` と `UpdateCommunityInput` が両方 `name`/`description`/`generationInstruction` を持つことを利用して、Union型か共通インターフェースで対処する。

実際には `form.Field` に渡すフィールド名が文字列リテラル型として検証されるため、型安全を保ちながら共通化するには `form` オブジェクトを渡すのが最適。

## TDD 方針

1. `CommunityFormFields.test.tsx` を新規作成し、コンポーネントの描画テストを書く
2. テストが失敗することを確認してコミット
3. `CommunityFormFields.tsx` を実装してテストを通す
4. `CommunitiesTab.tsx` をリファクタリングして既存テスト (`CommunitiesTab.test.tsx`) が全緑のまま通ることを確認
