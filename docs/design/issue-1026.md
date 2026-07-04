# 設計書: 画像アップロード失敗時にエラーハンドリング・ユーザーフィードバックが無い（useImageUpload）(#1026)

## 1. 目的 / 背景

`client/src/hooks/useImageUpload.ts` の `handleFileChange` は `upload(file)` の失敗を一切ハンドリングしておらず、アップロードが reject した場合に unhandled promise rejection となる。`WorkerImageUpload.tsx` / `CommunityImageUpload.tsx` の呼び出し側も `void handleFileChange(e)` の fire-and-forget で、ユーザーに成功/失敗の通知が無い。

類似コンポーネント `PushSubscribeButton` は try/catch + `setError` + `Typography color="error"` でエラーフィードバックを実装している（参照実装）。

## 2. スコープ（やること / やらないこと）

### やること
- `useImageUpload` に `onError?: (error: unknown) => void` オプションを追加
- `handleFileChange` に try/catch を追加し、失敗時に `onError` を呼び出す（`onSuccess` は呼ばれない）
- `WorkerImageUpload` / `CommunityImageUpload` に内部 `errorMessage` state を追加し、失敗時にエラー文字列を `Typography color="error"` で表示
- 上記 3 点のテストを追加

### やらないこと
- アップロード失敗時のリトライ機構
- ファイルバリデーション仕様の変更

## 3. 受け入れ条件（テストに落とせる粒度）

1. `useImageUpload`: `upload` が reject するモックを渡すと `onError` が呼ばれ `onSuccess` は呼ばれない
2. `WorkerImageUpload`: `mutateAsync` が reject した際にエラー文言が表示される（role=alert 相当 or テキスト一致）
3. `CommunityImageUpload`: 同上
4. `pnpm --filter @hatchery/client test` が緑
5. `pnpm --filter @hatchery/client lint` が緑

## 4. 設計方針

### useImageUpload
- `UseImageUploadOptions<TResult>` に `onError?: (error: unknown) => void` を追加
- `handleFileChange` を try/catch で包む。catch ブロックで `onError?.(err)` を呼ぶ。`onSuccess` は try ブロック内（`upload` 成功後）のみ呼ぶ

### WorkerImageUpload / CommunityImageUpload
- `const [errorMessage, setErrorMessage] = useState<string | null>(null)` を追加
- `useImageUpload` に `onError: (err) => setErrorMessage(err instanceof Error ? err.message : "アップロードに失敗しました")` を渡す
- JSX に `{errorMessage && <Typography variant="body2" color="error">{errorMessage}</Typography>}` を追加（アップロードエリアの下）
- 次のアップロード試行時（`handleFileChange` 呼び出し時）にエラーをクリアする

### e2e ユースケース
管理画面のアップロード失敗表示は admin 限定機能。既存の e2e usecases に admin 向けエラーフィードバックの振る舞い記述を追加する。

## 5. 影響範囲 / 既存への変更

- **対象ワークスペース**: `client/`
- **変更ファイル**:
  - `client/src/hooks/useImageUpload.ts`（onError 追加・try/catch）
  - `client/src/components/WorkerImageUpload.tsx`（errorMessage state・表示）
  - `client/src/components/CommunityImageUpload.tsx`（同上）
  - `client/src/hooks/useImageUpload.test.ts`（onError テスト追加）
  - `client/src/components/WorkerImageUpload.test.tsx`（失敗時エラー表示テスト）
  - `client/src/components/CommunityImageUpload.test.tsx`（同上）

## 6. テスト計画

| # | テスト | 検証内容 |
|---|--------|---------|
| 1 | `useImageUpload`: upload reject → onError 呼ばれる・onSuccess 呼ばれない | onError コールバック |
| 2 | `WorkerImageUpload`: mutateAsync reject → エラーメッセージ表示 | Typography color="error" |
| 3 | `CommunityImageUpload`: mutateAsync reject → エラーメッセージ表示 | 同上 |

## 7. リスク・未決事項

- エラーメッセージのクリアタイミング: 次のファイル選択時（`handleFileChange` 冒頭）にクリアする。ユーザーが「別のファイルを選ぶ」操作でエラーが消える自然な UX。
