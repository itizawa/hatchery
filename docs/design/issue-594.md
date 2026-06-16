# 設計書: 画像アップロードの共通ロジックを抽出する（WorkerImageUpload / CommunityImageUpload の重複） (#594)

## 1. 目的 / 背景

`WorkerImageUpload.tsx` と `CommunityImageUpload.tsx` は、ファイル選択・即時アップロードの mechanics（`inputRef`・`handleClick`・`handleFileChange`・`ACCEPTED_MIME`・hidden input）がほぼ同一コピーになっている。共通フックへ抽出して重複と表記ドリフトを解消する。

## 2. スコープ（やること / やらないこと）

**やること**
- `client/src/hooks/useImageUpload.ts` を新規作成し、ファイル選択・即時アップロードの共通ロジックを `useImageUpload` フックとして実装する
- `ACCEPTED_MIME` 定数をフックファイルでエクスポートし、両コンポーネントで import する
- `WorkerImageUpload` / `CommunityImageUpload` が `useImageUpload` フックを利用するよう更新する

**やらないこと**
- UI の変更（ユーザー可視挙動を変えない）
- 既存テスト（WorkerImageUpload.test.tsx / CommunityImageUpload.test.tsx）の変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `useImageUpload` フックが `inputRef`・`handleClick`・`handleFileChange`・`handleKeyDown` を返す
2. `handleFileChange` でファイルが選択されると `upload` 引数に File を渡して呼び出し、`onSuccess` コールバックが実行される
3. ファイルが未選択の場合（`files` が空）は `upload` を呼ばない
4. `handleFileChange` 後にファイル入力値がリセットされる（`e.target.value = ""`）
5. `ACCEPTED_MIME` が `useImageUpload.ts` から export され、両コンポーネントが import して使う
6. 既存テスト `WorkerImageUpload.test.tsx` / `CommunityImageUpload.test.tsx` が緑のまま
7. `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### `useImageUpload<TResult>` フックのインターフェース

```typescript
interface UseImageUploadOptions<TResult> {
  /** File を受け取りアップロードを実行する関数（mutateAsync のラッパー） */
  upload: (file: File) => Promise<TResult>;
  /** アップロード中フラグ（mutation.isPending） */
  isPending: boolean;
  /** アップロード成功後のコールバック */
  onSuccess?: (result: TResult) => void;
}

function useImageUpload<TResult>(options: UseImageUploadOptions<TResult>): {
  inputRef: React.RefObject<HTMLInputElement | null>;
  handleClick: () => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleKeyDown: (e: React.KeyboardEvent) => void;
}
```

### 利用側（WorkerImageUpload）

```typescript
const upload = useUploadWorkerImage();
const { inputRef, handleClick, handleFileChange, handleKeyDown } = useImageUpload({
  upload: (file) => upload.mutateAsync({ workerId, file }),
  isPending: upload.isPending,
  onSuccess,
});
```

### 利用側（CommunityImageUpload）

```typescript
const upload = useUploadCommunityImage();
const { inputRef, handleClick, handleFileChange, handleKeyDown } = useImageUpload({
  upload: (file) => upload.mutateAsync({ communityId, kind, file }),
  isPending: upload.isPending,
  onSuccess,
});
```

## 5. 影響範囲 / 既存への変更

- **client**: 新規 `src/hooks/useImageUpload.ts`（+ `useImageUpload.test.ts`）
- **client**: `src/components/WorkerImageUpload.tsx` — フック利用に書き換え
- **client**: `src/components/CommunityImageUpload.tsx` — フック利用に書き換え
- **server / common / docs**: 変更なし

## 6. テスト計画（TDDで書くテスト一覧）

`client/src/hooks/useImageUpload.test.ts`:
- ファイルを選択すると `upload` が呼ばれ `onSuccess` が実行される
- ファイルが空の場合は `upload` が呼ばれない
- `handleClick` が `inputRef.current.click()` を呼ぶ
- `handleKeyDown` で Enter/Space キーが押されると `handleClick` が呼ばれる
- `isPending=true` のとき `handleKeyDown` は何もしない

## 7. リスク・未決事項

- なし（純粋なリファクタ。UI変更なし・ユーザー可視挙動不変）
