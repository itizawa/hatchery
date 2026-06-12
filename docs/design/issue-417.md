# 設計書: SettingsScene の API トークンフォームを @tanstack/react-form に移行する (#417)

## 1. 目的 / 背景

`client/src/routes/SettingsScene.tsx` の `ApiTokenSettings` コンポーネントが、フォームフィールド `apiKey` を生の `useState` で管理しており、CLAUDE.md「フォーム規約」（#262）に違反している。他のすべてのフォームは `useForm` に移行済みで、SettingsScene のみ残存。

## 2. スコープ（やること / やらないこと）

**やること**:
- `ApiTokenSettings` の `apiKey` 用 `useState` を削除し `useForm` / `form.Field` に置き換える
- 既存挙動（保存成功でクリア＋Snackbar・エラー表示・maxLength・disabled）を維持
- `SettingsScene.test.tsx` に useForm 移行後の挙動テストを追加

**やらないこと**:
- SettingsScene の他タブ（バッチログ・トークン使用量等）の変更
- Snackbar 開閉用の `useState`（非フォーム UI 状態）の変更
- SettingsScene 全体の構造変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `ApiTokenSettings` が `useForm` / `form.Field` でフォーム状態を管理し、`apiKey` 用の生 `useState` が存在しない
2. 保存成功時に入力フィールドがクリアされる
3. 保存成功時に成功 Snackbar が表示される
4. 保存失敗時にエラー Snackbar が表示される
5. `inputProps={{ maxLength: APP_SETTING_VALUE_MAX_LENGTH }}` が維持される
6. 保存中（`isPending`）はボタンが disabled になる
7. `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### 実装方針

`useForm` の `onSubmit` ハンドラ内で `saveMutation.mutateAsync` を呼び出し、成功時は `form.reset()` でフォームをリセットして Snackbar を開く。

```tsx
const form = useForm({
  defaultValues: { apiKey: "" },
  onSubmit: async ({ value }) => {
    try {
      await saveMutation.mutateAsync({ key: "CLAUDE_API_KEY", value: value.apiKey });
      form.reset();
      setSnackbarOpen(true);
    } catch {
      setErrorOpen(true);
    }
  },
});
```

`form.Field` で `apiKey` を管理し、TextField の `value` / `onChange` を `field.state.value` / `field.handleChange` に切り替える。

`<Box component="form" onSubmit={...}>` + `<Button type="submit">` または `form.handleSubmit()` を使用する。LoginScene の実装パターンに従い `form.handleSubmit()` を `onSubmit` で呼び出す。

### ボタンの disabled 条件

`saveMutation.isPending` は `useForm` の `form.state.isSubmitting` で代替可能だが、`saveMutation.isPending` を直接参照する方が明示的で既存の挙動と一致する。両方を OR で組み合わせる。

## 5. 影響範囲 / 既存への変更

- `client/src/routes/SettingsScene.tsx` — `ApiTokenSettings` コンポーネントのフォーム状態管理変更
- `client/src/routes/SettingsScene.test.tsx` — APIキー保存フローのテストを追加

## 6. テスト計画（TDDで書くテスト一覧）

1. `APIキーを入力して「保存」を押すと saveMutation が呼ばれ、入力がクリアされる`
2. `保存成功後に成功Snackbarが表示される`
3. `保存失敗時にエラーSnackbarが表示される`
4. `保存中はボタンが disabled になる`

## 7. リスク・未決事項

- `useForm` の `form.reset()` が同期的にフィールド値をクリアするか確認が必要（`@tanstack/react-form` の仕様）
- 既存テストの `autocomplete='off'` 検証が引き続き通ることを確認する
