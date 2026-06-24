# 設計書: EditWorkerDialog のコミュニティ読み込み完了時に Dialog がちらつく問題を修正する (#832)

## 1. 目的 / 背景

`EditWorkerDialog` は参加コミュニティ一覧を非同期取得する。現状は
`key={isInitializing ? "loading" : "ready"}` で Dialog ごと再マウントする回避策を採っており、
データ到着時に MUI Dialog の open アニメーションが再実行されてちらつきとして見える。
また `useForm` の `defaultValues.communityIds` が `[]` のまま form がマウントされるため
`isDirty` の誤判定も起きている。

## 2. スコープ（やること / やらないこと）

**やること**
- `useForm` を含む form 部分を `EditWorkerFormContent`（ファイル内の非公開コンポーネント）として切り出す
- `isInitializing` が `false` になってから `EditWorkerFormContent` をマウントする
- `Dialog` から `key` を除去してリマウントを止める

**やらないこと**
- 他の Dialog（`AddWorkerDialog` 等）への同パターン適用
- `isDirty` を使ったボタン制御の追加（別 Issue）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `isInitializing = true` の間、Dialog 内はローディングインジケーターのみ表示され、フォームフィールド（表示名など）は表示されない
2. `isInitializing = false` 後、`EditWorkerFormContent` がマウントされ、`useForm.defaultValues.communityIds = initialCommunityIds` で初期化される
3. 初期マウント直後（ユーザー操作前）は `isDirty = false`
4. 編集・保存・キャンセルの既存動作が壊れていない（既存テスト全通過）
5. `pnpm turbo run build test lint` が緑

## 4. 設計方針

### コンポーネント分割

```
EditWorkerDialog（公開）
  ├ useWorkerCommunities          // 非同期取得
  ├ useUpdateWorker              // 更新 mutation
  ├ useSetWorkerCommunities      // コミュニティ置換 mutation
  ├ handleSubmit()               // submit ロジック（mutations + onClose 呼び出し）
  └ <Dialog>
       ├ <DialogTitle>
       ├ isInitializing ? <DialogContent>（ローディング）
       └             : <EditWorkerFormContent ...props />
       └ <Snackbar>（エラー表示）

EditWorkerFormContent（非公開）
  ├ useForm（defaultValues.communityIds = initialCommunityIds で初期化）
  ├ <DialogContent>（全フォームフィールド）
  └ <DialogActions>（保存/キャンセルボタン）
```

### props インターフェース

```ts
interface EditWorkerFormContentProps {
  worker: Worker;
  initialCommunityIds: string[];
  canEditCommunities: boolean;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (value: FormValues) => Promise<void>;
}
```

`handleSubmit` は親で定義し `onSubmit` 経由で渡す。`canEditCommunities` で
WorkerCommunitiesField の表示/非表示を制御。

## 5. 影響範囲 / 既存への変更

- `client/src/components/EditWorkerDialog.tsx` — リファクタ（動作変更なし）
- `client/src/components/EditWorkerDialog.test.tsx` — 新テスト追加（既存テストは変更しない）

## 6. テスト計画（TDD で書くテスト一覧）

| # | テスト内容 | 期待 |
|---|-----------|------|
| 新1 | `isLoading=true` のとき読み込みインジケーターが表示され表示名フィールドは表示されない | `getByText(/読み込み中/)` 存在 / `queryByLabelText(/表示名/)` 非存在 |
| 既1〜N | 既存テスト全件（`isLoading=false` で動作検証済み） | 全通過（変更なし） |

## 7. リスク・未決事項

- リスクなし。変更範囲が `EditWorkerDialog.tsx` 単ファイルに限定されており、
  他コンポーネントへの波及はない。
- e2e 更新不要（ユーザー可視の振る舞い変化なし）。
