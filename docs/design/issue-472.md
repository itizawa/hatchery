# Issue #472 設計書: AccountScene のプロフィール更新失敗時にエラーを表示する

## 背景・問題

`client/src/routes/AccountScene.tsx` のプロフィール更新 mutation は成功時のみ Snackbar を出し、失敗時のフィードバックが一切ない。`updateMutation` に `onError` が無く、`onSubmit` 内の `await updateMutation.mutateAsync(...)` も try/catch されていないため、API がエラー（バリデーション失敗・401・500・ネットワーク断）を返してもユーザーは気付けず、保存できたと誤認する。成功 Snackbar（`snackbarOpen`）はあるのに失敗フィードバックが欠落しており非対称。

他画面（`SettingsScene` の API トークン設定タブ / `EditWorkerDialog`）は #476 で `mutation.isError` / `mutation.error` にエラーを集約し、`getApiErrorMessage` でサーバ由来文言を error Snackbar に表示する形に統一されている。AccountScene だけ未対応。

## 受け入れ条件 → 入出力

| # | 受け入れ条件 | 入力（操作・状態） | 出力（観察可能な振る舞い） |
|---|--------------|-------------------|---------------------------|
| 1 | 更新 mutation 失敗時にエラー表示を出す。`isError` / `onError` いずれかでハンドル | `updateProfile` が reject する状態で保存ボタン押下 | error severity の Snackbar が表示され、エラーメッセージが出る |
| 2 | 成功時は従来通り成功 Snackbar（退行させない） | `updateProfile` が resolve する状態で保存ボタン押下 | 「保存しました」Snackbar が表示される |
| 3 | RTL テストに「失敗するとエラー表示が出る」ケースを追加 | — | `AccountScene.test.tsx` に失敗ケースを追加 |
| 4 | フォーム状態管理は引き続き `@tanstack/react-form` | — | `useForm` / `form.Field` を維持（生 useState フォーム管理を増やさない） |
| 5 | `pnpm turbo run build test lint` が緑 | — | CI 緑 |

## 設計判断

### エラー表示は mutation 状態に集約する（#476 の参照実装に統一）

`SettingsScene` / `EditWorkerDialog` と同じく、エラー表示用の独立ローカル state（`errorOpen` 等）は持たず、`updateMutation.isError` / `updateMutation.error` を直接 Snackbar の `open` と本文に使う。利点:

- 再送信成功で `isError=false` に戻り、残留しない。
- サーバが返す `{ error: string }` 文言を `getApiErrorMessage(error, fallback)` で表示でき、400/500/ネットワーク断のいずれも拾える。
- 周辺コードと一貫した実装になり、レビュー上の認知負荷が低い。

成功 Snackbar（`snackbarOpen`）は機能上「保存しました」を一定時間だけ自動表示するトーストであり、mutation 状態（`isSuccess`）は次回送信まで残るため従来どおり独立 state を維持する（退行回避・受け入れ条件 2）。エラー側のみ mutation 状態へ寄せる。

### `onSubmit` で mutateAsync の reject を握りつぶす（未処理 Promise 回避）

`onSubmit` 内の `await updateMutation.mutateAsync(...)` を try/catch で囲む。`catch` では何もしない（表示は `updateMutation.isError` に委ねる）。これは reject を `form.handleSubmit()` の外へ伝播させて未処理 Promise rejection を生むのを避けるためで、`SettingsScene` / `EditWorkerDialog` と同じパターン。成功 Snackbar の `setSnackbarOpen(true)` は `try` の正常系末尾に置き、失敗時は出さない（成否を取り違えないため）。

### Snackbar の閉じ方

error Snackbar の `onClose` では `updateMutation.reset()` を呼び、`isError` を `false` に戻して残留させない（EditWorkerDialog と同じ）。`autoHideDuration` は他のエラー Snackbar に合わせ 6000ms（成功は 3000ms のまま）。

## テスト方針（TDD）

`client/src/routes/AccountScene.test.tsx` の「プロフィール編集フォーム」describe に失敗ケースを追加する:

- `updateProfile` を `mockRejectedValue(new Error("サーバが返した文言"))` にスタブ。
- 表示名を変更して保存ボタンを押す。
- error Snackbar の文言（サーバが返した `Error.message`）が表示されることを `findByText` で検証する。
- 既存の成功ケース（「保存成功時にスナックバーが表示される」）はそのまま維持し退行を検出する。

まずこのテストを追加して赤を確認 → コミット → AccountScene を最小修正して緑にする。

## e2e ユースケース

`/account`（プロフィール編集）は既存 e2e エリアに無いため、本 PR で `account` エリアを新設し、プロフィール編集の観察可能な振る舞い（成功 / 失敗時のフィードバック）をユースケース化する。`e2e/account/usecases.md` を追加し、`e2e/account/account.spec.ts` に対応する `test.todo()` を置き、`e2e/usecases.md` のエリア一覧とサマリへ反映する。

## スコープ外

- 400 と 500 の文言出し分け（Issue 補足で別 Issue 方針）。本 PR は最低限の失敗フィードバック追加に限定。
</content>
</invoke>
