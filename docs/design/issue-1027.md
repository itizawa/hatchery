# 設計書: WorkerImageUpload / CommunityImageUpload の isPending 分岐とアップロード実行フローのテストを追加する (#1027)

## 1. 目的 / 背景

`WorkerImageUpload.tsx` は branches 42.9%、`CommunityImageUpload.tsx` は branches 62.5% と低カバレッジ。
既存テストは `isPending: false` 固定のモックのみを使用しており、アップロード中の UI 状態（CircularProgress オーバーレイ・クリック無効化）と、ファイル選択後の `mutateAsync` 実行フローがテストされていない。

## 2. スコープ（やること / やらないこと）

**やること:**
- `WorkerImageUpload.test.tsx`: `isPending=true` のとき CircularProgress が表示されること・クリックが無効化されること の 2 ケースを追加
- `CommunityImageUpload.test.tsx`: ファイル選択 → `mutateAsync({ communityId, kind, file })` 呼び出し → `onSuccess` 呼び出しのインタラクションテストを追加
- `CommunityImageUpload.test.tsx`: `isPending=true` のとき CircularProgress が表示されること・クリックが無効化されること の 2 ケースを追加

**やらないこと:**
- アップロード失敗時のエラーハンドリング改善（別 Issue）
- `useImageUpload` フック自体の変更
- コンポーネント実装の変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `WorkerImageUpload.test.tsx` に `isPending: true` でモックしたケースを追加し、`CircularProgress`（`role="progressbar"`）が表示されることを検証する
2. `WorkerImageUpload.test.tsx` に `isPending: true` でモックしたケースを追加し、ボタンをクリックしても `inputRef.current.click()` が呼ばれない（ファイル選択ダイアログが開かない）ことを検証する
3. `CommunityImageUpload.test.tsx` に、ファイル選択で `useUploadCommunityImage().mutateAsync` が `{ communityId, kind, file }` で呼ばれ成功後 `onSuccess` が呼ばれることを検証するインタラクションテストを追加する
4. `CommunityImageUpload.test.tsx` に `isPending: true` のとき `CircularProgress` が表示されることを検証するテストを追加する
5. `CommunityImageUpload.test.tsx` に `isPending: true` のときクリックしてもファイル選択ダイアログが開かないことを検証するテストを追加する
6. 追加後、両コンポーネントの branches カバレッジが現状値（42.9% / 62.5%）を上回ること
7. `pnpm turbo run build|test|lint` が緑であること

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### モックの可変化

既存モックは `isPending: false` 固定。テストごとに `isPending` を変えるため、`vi.hoisted()` でミュータブルなオブジェクトを用意し、`get isPending()` ゲッターでその時点の値を返す。

```ts
const mockIsPending = vi.hoisted(() => ({ value: false }));
vi.mock("../api/workers.js", () => ({
  useUploadWorkerImage: () => ({
    mutateAsync: mockMutateAsync,
    get isPending() { return mockIsPending.value; },
  }),
}));
```

### クリック無効化の検証

`upload.isPending=true` のとき Box の `onClick` は `undefined` になり、`handleClick`（= `inputRef.current?.click()`）が呼ばれない。
`vi.spyOn(HTMLInputElement.prototype, "click")` でスパイし、ボタンをクリックしてもスパイが呼ばれていないことを検証する。

## 5. 影響範囲 / 既存への変更

- `client/src/components/WorkerImageUpload.test.tsx`（テスト追加・モック可変化のリファクタ）
- `client/src/components/CommunityImageUpload.test.tsx`（テスト追加・モック可変化のリファクタ）

コンポーネント実装・共通ロジックへの変更なし。

## 6. テスト計画（TDD で書くテスト一覧）

| コンポーネント | ケース | 検証内容 |
|---------------|--------|----------|
| WorkerImageUpload | `isPending=true` で CircularProgress 表示 | `getByRole("progressbar")` が存在する |
| WorkerImageUpload | `isPending=true` でクリック無効 | `HTMLInputElement.prototype.click` スパイが呼ばれない |
| CommunityImageUpload | ファイル選択フロー | `mutateAsync({ communityId, kind, file })` 呼ばれ `onSuccess` が呼ばれる |
| CommunityImageUpload | `isPending=true` で CircularProgress 表示 | `getByRole("progressbar")` が存在する |
| CommunityImageUpload | `isPending=true` でクリック無効 | `HTMLInputElement.prototype.click` スパイが呼ばれない |

## 7. リスク・未決事項

- MUI の `CircularProgress` は `role="progressbar"` を持つため `getByRole("progressbar")` で取得可能（確認済み）。
- `HTMLInputElement.prototype.click` のスパイは jsdom 環境で動作する（RTL の標準的なパターン）。
