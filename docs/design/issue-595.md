# 設計書: CommunitiesTab の作成/編集フォームのフィールド重複を共通化する (#595)

## 1. 目的 / 背景

`client/src/components/CommunitiesTab.tsx` の `CreateCommunityForm` と `EditCommunityForm` で `name`/`description`/`generationInstruction` の `form.Field` + `TextField` ブロックがほぼ完全コピーになっている。これを共通コンポーネントへ抽出して重複を解消する。

## 2. スコープ（やること / やらないこと）

**やること:**
- `name`/`description`/`generationInstruction` の 3 フィールドを `CommunityFormFields` コンポーネントへ抽出する
- `CreateCommunityForm` / `EditCommunityForm` が `CommunityFormFields` を共有する
- 既存テスト（`CommunitiesTab.test.tsx`）を緑のまま維持する

**やらないこと:**
- `slug` フィールドの共通化（`CreateCommunityForm` 専用のため対象外）
- 画像アップロード部分の移動（`EditCommunityForm` 専用のため対象外）
- ユーザー可視の振る舞いの変更（純粋なリファクタリング）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `CommunityFormFields` コンポーネントが `name`/`description`/`generationInstruction` の入力欄を描画すること
2. `CreateCommunityForm` / `EditCommunityForm` が `CommunityFormFields` を利用すること
3. フォーム状態管理は `@tanstack/react-form` の `form.Field` を維持すること（#262 遵守）
4. 既存テスト（`CommunitiesTab.test.tsx` 9 件）が緑のまま維持されること
5. `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### CommunityFormFields コンポーネント

```
client/src/components/CommunityFormFields.tsx（新規）
```

- `form` オブジェクト（`@tanstack/react-form` の `useForm` が返すもの）を props として受け取る
- `form.Field` で `name`/`description`/`generationInstruction` を描画する
- `@tanstack/react-form` の `FormApi` / `ReactFormApi` ジェネリクスは複雑なため、`form.Field` の型は `{ Field: any }` として受け取る

### CommunitiesTab.tsx の変更

`CreateCommunityForm` と `EditCommunityForm` から重複する 3 フィールドブロックを削除し、`<CommunityFormFields form={form} />` に置き換える。

### value の正規化

`CreateCommunityForm` では一部フィールドが `value={field.state.value}` だったが、`EditCommunityForm` に合わせて `value={field.state.value ?? ""}` に統一する（`undefined` を空文字に正規化）。

## 5. 影響範囲 / 既存への変更

**対象ワークスペース**: `client`のみ

- `client/src/components/CommunityFormFields.tsx`（新規作成）
- `client/src/components/CommunitiesTab.tsx`（修正: `name`/`description`/`generationInstruction` の 3 フィールドブロックを抽出）

**ユーザー可視の振る舞いは不変**（純粋なリファクタリング）

## 6. テスト計画（TDD で書くテスト一覧）

**新規テスト: `client/src/components/CommunityFormFields.test.tsx`**

1. `CommunityFormFields` が `name`/`description`/`generationInstruction` の入力欄を描画すること
2. `name` / `description` は required 属性を持つ、`generationInstruction` は持たない

**既存テスト（回帰チェック）: `CommunitiesTab.test.tsx` の 9 件をすべて緑に維持**

## 7. リスク・未決事項

- `@tanstack/react-form` の `form.Field` ジェネリクスが複雑で、`FormApi<CreateCommunityInput>` と `FormApi<UpdateCommunityInput>` は TypeScript 的に互換性がない。`{ Field: any }` 型で受け取ることで回避する。
- `value` の正規化（`?? ""`）は動作に影響なし（`undefined` → `""` のみ）。
