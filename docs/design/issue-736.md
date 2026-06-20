# issue-736: CommunityFormFields.tsx の AnyForm 型を @tanstack/react-form の型で置き換えて any 型を排除する

## 1. 背景

`client/src/components/CommunityFormFields.tsx` には以下の問題がある。

```ts
type AnyForm = { Field: any };
```

この型定義により `form.Field` の子関数内で `field: any` を多用しており、
ESLint の `@typescript-eslint/no-explicit-any` を `/* eslint-disable */` で無効化している。

元の設計書（`docs/design/issue-595.md §7`）では「`@tanstack/react-form` の `FormApi<CreateCommunityInput>` と
`FormApi<UpdateCommunityInput>` は TypeScript 的に互換性がない」として暫定的に `any` を使っていたが、
ジェネリクス制約によって解消できる。

## 2. 目的

`any` 型を排除して型安全な実装にし、ESLint の `@typescript-eslint/no-explicit-any` ルールに準拠させる。

## 3. 設計方針

### 共通フィールド型の定義

`CreateCommunityInput` と `UpdateCommunityInput` が共有するフィールドを型として定義する。

```ts
/** CommunityFormFields が使用するフォームデータの最小インターフェース。 */
interface CommunityFormData {
  name: string;
  description: string;
  generationInstruction?: string | null | undefined;
}
```

### ジェネリック関数で型制約を付ける

`CommunityFormFields` をジェネリック関数にし、`TData extends CommunityFormData` で制約する。

`@tanstack/react-form` の `ReactFormExtendedApi` 型は12個のジェネリクスを持ち複雑なため、
`@tanstack/form-core` が提供する `AnyFormApi` 型（= `FormApi<any, any, ...>`）をベースとした
型制約を使う方法も検討した。

しかし `AnyFormApi` では `Field` コンポーネントの呼び出しで `name` の型チェックが効かない。
受け入れ条件 2（フィールド名が型で検証される）を満たすためには、`FormApi` のジェネリクスを
`TData` で固定する必要がある。

### 採用する型パターン

`@tanstack/react-form` の `ReactFormExtendedApi` 型は以下の構造。

```ts
type ReactFormExtendedApi<TFormData, TOnMount, TOnChange, TOnChangeAsync, TOnBlur, TOnBlurAsync,
  TOnSubmit, TOnSubmitAsync, TOnDynamic, TOnDynamicAsync, TOnServer, TSubmitMeta>
```

バリデーション関連の型パラメータ（TOnMount〜TSubmitMeta）はすべて `undefined` でよく、
`ReactFormExtendedApi<TData, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, never>` が
`useForm({ defaultValues: TData, ... })` の返り値の最小型として機能する。

ただし TypeScript の型推論が働くため、props として受け取る際に各バリデーション型パラメータに
`undefined` を指定することは過剰であり、実用上は `FormApi<TData>` の構造的サブタイプとして
`Field` プロパティが適切に型付けされている `ReactFormExtendedApi<TData, any, any, ...>` を使う。

**最終採用方針**: ジェネリック型パラメータを `TData extends CommunityFormData` に絞り、
`form` の型は `{ Field: ReactFormExtendedApi<TData, ...>['Field'] }` ではなく、
`useForm<TData>` が返す型そのものを受け取れるよう構造的型付けを活用する。

具体的には `@tanstack/react-form` から `ReactFormExtendedApi` を import し、
`unknown` をデフォルト値にした上限付きジェネリクスで受け取る。

### 最終型定義

```ts
import type { ReactFormExtendedApi } from "@tanstack/react-form";

interface CommunityFormData {
  name: string;
  description: string;
  generationInstruction?: string | null | undefined;
}

export interface CommunityFormFieldsProps<TData extends CommunityFormData> {
  form: ReactFormExtendedApi<TData, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, never>;
}
```

`validators` を使う場合（`onSubmit` バリデーターを持つ場合）も `undefined` 型パラメータで正しく動作する。
なぜなら validators は `form.Field` 内部で処理され、props の型はフォームデータの型のみが重要であるため。

`field` の型は `FieldApi<TData, 'name' | 'description' | 'generationInstruction', ...>` となり、
`field.state.value` / `field.handleChange` / `field.handleBlur` / `field.state.meta.errors` が
型安全に参照できる。

### 呼び出し元の変更

`CreateCommunityInput` と `UpdateCommunityInput` はいずれも `name, description, generationInstruction`
フィールドを持つため、`CommunityFormData` の構造的サブタイプとして機能する。

```ts
// CreateCommunityForm（CommunitiesTab.tsx）
const form = useForm({ defaultValues: { slug: "", name: "", ... } as CreateCommunityInput, ... });
// → form の型は ReactFormExtendedApi<CreateCommunityInput, ...>
// → CreateCommunityInput は CommunityFormData のサブタイプ → CommunityFormFields に渡せる

// EditCommunityForm（CommunitiesTab.tsx）
const form = useForm({ defaultValues: { name: "", ... } as UpdateCommunityInput, ... });
// → 同様に CommunityFormData サブタイプとして機能
```

### eslint-disable コメントの削除

`any` 型を完全に排除することで先頭の `/* eslint-disable @typescript-eslint/no-explicit-any */`
コメントを削除できる。

## 4. 実装計画（TDD）

### テスト（既存を維持し、型チェックが通ることを確認）

既存の `CommunityFormFields.test.tsx` は動作として正しいため変更不要。
テストはジェネリクス変更に影響されない（テスト内の `useForm` が正しい型で form を作成するため）。

型安全性のテストは TypeScript コンパイラによって保証される（`pnpm typecheck`）。

### 実装手順

1. `docs/design/issue-736.md` を作成してコミット（この設計書）
2. `client/src/components/CommunityFormFields.tsx` を修正:
   - `type AnyForm = { Field: any }` を削除
   - `/* eslint-disable @typescript-eslint/no-explicit-any */` コメントを削除
   - `ReactFormExtendedApi` を import
   - `CommunityFormData` interface を定義
   - `CommunityFormFieldsProps` をジェネリクス化
   - `field: any` アノテーションを削除（型推論に任せる）
   - validators の `({ value }: any)` を型推論に任せる

## 5. 受け入れ条件の照合

| 条件 | 対応 |
|------|------|
| 1. `any` 型使用を排除 | `AnyForm` 型削除・`field: any` 削除・validators `any` 削除 |
| 2. フィールド名が型で検証される | `ReactFormExtendedApi<TData>` で `name="name"` が `DeepKeys<TData>` に制約される |
| 3. `eslint-disable` コメント削除 | ファイル先頭のコメント行を削除 |
| 4. 両フォームで使える | `CommunityFormData` への構造的サブタイプ制約で両方対応 |
| 5. build・lint・typecheck 緑 | 実装後に確認 |

## 6. 補足

- `@tanstack/react-form` v1.33.0 を使用。バージョンアップは対象外。
- 参照実装: `client/src/routes/AccountScene.tsx`（`useForm` + `form.Field` の型安全な例）
- 関連 Issue: #262（フォーム規約）, #595（CommunityFormFields 初期実装）, #91（バリデーション上限）
