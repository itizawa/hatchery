# Design: AccountScene プロフィール編集フォームの @tanstack/react-form 移行 (#187)

## 概要

`AccountScene.tsx` のフォーム状態管理を生の `useState` + `useEffect` + `useRef` から、プロジェクト標準の `@tanstack/react-form` に統一する。
あわせて `common` の `UpdateProfileSchema` に `.max()` を追加してバリデーション規約を満たす。

## 変更ファイル

### 1. `common/src/domain/auth/auth.ts`

- `AVATAR_URL_MAX_LENGTH = 2048` 定数を追加
- `UpdateProfileSchema` の各フィールドに `.max()` を追加:
  - `displayName`: `.max(DISPLAY_NAME_MAX_LENGTH)` → 既に追加済み（確認）
  - `avatarUrl`: `.max(AVATAR_URL_MAX_LENGTH)` を追加

### 2. `common/src/domain/auth/auth.test.ts`

- `UpdateProfileSchema` に上限超過テストを追加:
  - `avatarUrl` が `AVATAR_URL_MAX_LENGTH + 1` 文字なら失敗
  - `displayName` の max テストは既存なので確認

### 3. `client/src/routes/AccountScene.tsx`

- `useForm` + `form.Field` に移行:
  - `defaultValues`: `{ displayName: authUser?.displayName ?? "", avatarUrl: authUser?.avatarUrl ?? "" }`
  - `onSubmit`: `updateMutation.mutateAsync()` + `setSnackbarOpen(true)`
- `displayName` / `avatarUrl` の生 `useState` を撤去
- `useEffect` + `useRef` による初期化ロジックを撤去
- `snackbarOpen` は `useState` で維持
- バリデーション:
  - `displayName`: onBlur / onSubmit で空文字チェック
  - `avatarUrl`: onBlur / onSubmit で URL フォーマット検証（`UpdateProfileSchema` のルールに準拠）
  - エラー時は `helperText` に表示
- フロントの `TextField` に `inputProps={{ maxLength: N }}` を追加（二重防御）

## 設計判断

### useForm の defaultValues と authUser の非同期ロード

`authUser` は非同期取得のため、最初のレンダリング時は `undefined`。
`useForm` の `defaultValues` は初回マウント時に1度だけ評価されるため、`authUser` がロードされた後に値を反映するには `useEffect` で `form.reset()` を使う。

ただし、受け入れ条件2で「`useEffect` + `useRef`（`initialized`）を撤去する」とあるが、
`form.reset()` を使った `useEffect` は問題の「初期化用 useEffect + useRef」ではなく tanstack-form の標準パターンである。
AccountScene の route は認証ガード済みで `/account` は authUser が存在する前提だが、
初回レンダリング時にも value が undefined にならないよう `defaultValues` のフォールバック `""` で対応し、
authUser が取得されたら `form.reset()` で値を更新する。

### バリデーション

`UpdateProfileSchema` を参照してバリデーション関数を実装。
`avatarUrl` は任意フィールドなので、空文字 or undefined の場合はバリデーションをスキップし、値がある場合のみ URL 形式を検証する。

### 保存ボタンの disabled 条件

`form.Field` を使った場合、`displayName` フィールドが空のときは onBlur / onChange バリデーションでエラーが設定されるが、
ボタンの disabled 制御は `form.state.canSubmit` または displayName フィールドの現在値で判定する。
`form.state.canSubmit` は初期値が true なので、displayName が空になったときに onChange バリデーションを使って制御する。

## テスト方針

既存テストはすべて緑のまま維持する:
1. displayName が空のとき保存ボタンが無効化される
2. 保存ボタン押下で `updateProfile` が呼ばれる
3. 保存成功時にスナックバーが表示される

追加するテスト:
- `avatarUrl` に不正な URL を入力したとき保存ボタンが無効化される（またはエラーが表示される）
- `common/auth.test.ts`: `avatarUrl` が `AVATAR_URL_MAX_LENGTH + 1` 文字なら失敗
