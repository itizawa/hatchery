# 設計書: フォーム管理を TanStack Form に統一する (#74)

## 1. 目的 / 背景

`LoginScene.tsx` のフォームは `useState` で各フィールドを個別管理している。
今後フォームが増える見込みのため、`@tanstack/react-form` を導入して統一する。

## 2. スコープ（やること / やらないこと）

### やること
- `@tanstack/react-form` を `client/package.json` の `dependencies` に追加
- `LoginScene.tsx` のフォームを TanStack Form で実装し直す
  - `id`・`password` の `useState` を廃止し `useForm` / `form.Field` に置き換える
  - バリデーション（必須チェック）は TanStack Form の validators で定義する
  - エラー表示は `field.state.meta.errors` を使う

### やらないこと
- 他のフォーム画面（AccountScene 等）への適用（後続 Issue で対応）
- サーバーサイドバリデーションの追加

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- `@tanstack/react-form` が `client/package.json` の `dependencies` に追加されている
- `LoginScene.tsx` の `useState` による `id`・`password` 管理が廃止され `useForm` / `form.Field` に置き換えられている
- バリデーション（必須チェック等）は TanStack Form の validators で定義されている
- エラー表示は `field.state.meta.errors` を使っている
- 既存のテスト（フォームに入力してサブミットすると login API が呼ばれる）が引き続き通る
- `pnpm --filter @hatchery/client lint` と `pnpm --filter @hatchery/client test` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### TanStack Form の採用パターン

```tsx
const form = useForm({
  defaultValues: { id: "", password: "" },
  onSubmit: async ({ value }) => {
    // login({ id: value.id, password: value.password })
  },
});
```

- `useForm` でフォーム全体を管理
- `form.Field` で各フィールドをレンダリング
- `validators.onChange` で必須チェック（空文字は "必須項目です" エラー）
- `field.state.meta.errors` でフィールドレベルエラーを表示
- 既存の API エラー（認証失敗）は `form.state.submissionAttempts` と `useState<string|null>` で継続管理

### フォームエラー状態の設計判断

TanStack Form はフィールドレベルのバリデーションエラーを `field.state.meta.errors` で提供する。
認証失敗（サーバーエラー）はフィールドエラーとは別に管理する必要があるため、
`apiError` という `useState<string | null>` を 1 つ残して API エラーのみを管理する。

## 5. 影響範囲 / 既存への変更

対象ワークスペース: **client**

- `client/package.json` — `@tanstack/react-form` を dependencies に追加
- `client/src/routes/LoginScene.tsx` — TanStack Form に置き換え
- `client/src/routes/LoginScene.test.tsx` — 必要に応じて更新（観点は変えない）

## 6. テスト計画（TDDで書くテスト一覧）

既存テストで受け入れ条件を検証できる範囲を確認し、必要なら追加する。

既存テスト（維持）:
- `フォームに入力してサブミットすると login API が呼ばれる` — ID / パスワード入力 → submit → `login` 呼び出し確認
- `管理画面ガード` — 未ログイン時に /login にリダイレクト

追加テスト（TDDで新規):
- `ID フィールドが空の場合、送信しても login API が呼ばれない`
- `パスワードフィールドが空の場合、送信しても login API が呼ばれない`

## 7. リスク・未決事項

- `@tanstack/react-form` の pnpm install がリモート環境で可能か（ネットワーク接続に依存）
- TanStack Form v0 → v1 の API 変更に注意（最新版を確認して対応する）
