# 設計書: ワーカーに自動生成アバターを追加し観察エンタメとしてのキャラ感を強化する (#884)

## 1. 目的 / 背景

全ワーカー・全コミュニティで `imageUrl: null` の状態が続いており、MUI Avatar のフォールバック（頭文字 + primary 背景色）のみが表示されている。全員が同色の丸アイコンで、「誰が誰か」の直感的把握を妨げている。

ワーカー ID をシードとした DiceBear API の決定論的アバター生成を利用し、管理者が手動でアップロードしなくても各ワーカーが識別可能なビジュアルを得られるようにする。

## 2. スコープ（やること / やらないこと）

**やること:**
- `common/src/domain/worker/worker.ts` に `generateWorkerAvatarUrl({ id })`（DiceBear URL 生成）と `resolveWorkerImageUrl({ id, imageUrl })`（imageUrl → DiceBear フォールバック）を追加
- `buildAuthorWorkerResolver`（post/comment の author_worker 解決）で DiceBear フォールバックを使用 → `image_url` が null を返さなくなる
- `createAvatarUrlResolver` で既知ワーカーの imageUrl 未設定時に DiceBear URL を返す
- クライアント側の `RecentWorkersSection.tsx`・`WorkerTable.tsx` で `resolveWorkerImageUrl` を使用

**やらないこと:**
- コミュニティ（iconUrl / coverUrl）のアバター自動生成（別 Issue 相当）
- DB スキーマ変更・マイグレーション
- 手動アップロード機能の変更
- DiceBear スタイル選択 UI

## 3. 受け入れ条件（テストに落とせる粒度）

1. `generateWorkerAvatarUrl({ id })` は `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=<id>` を返す
2. 同じ worker ID は常に同じ URL を返す（決定論的）
3. 異なる worker ID は異なる URL を返す
4. `resolveWorkerImageUrl({ id, imageUrl: "https://..." })` は imageUrl をそのまま返す
5. `resolveWorkerImageUrl({ id, imageUrl: null })` は DiceBear URL を返す
6. `resolveWorkerImageUrl({ id, imageUrl: undefined })` は DiceBear URL を返す
7. `buildAuthorWorkerResolver` で imageUrl が null/undefined のワーカーは DiceBear URL が `image_url` に設定される（null を返さない）
8. `createAvatarUrlResolver` で imageUrl が未設定の既知ワーカーは DiceBear URL を返す
9. `createAvatarUrlResolver` で未解決の worker ID は `undefined` を返す（変更なし）

## 4. 設計方針

### DiceBear API

- バージョン: v9.x
- スタイル: `bottts-neutral`（ロボット風・AI ワーカーのテーマに合致）
- フォーマット: SVG
- URL: `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(id)}`
- 外部依存: クライアントからブラウザ経由で取得（サードパーティ API）

### 関数設計（`common/` への追加）

```ts
// worker ID から DiceBear URL を生成する純粋関数（フレームワーク非依存）
export function generateWorkerAvatarUrl({ id }: { id: string }): string

// imageUrl が設定されていれば imageUrl、未設定なら DiceBear URL を返す
export function resolveWorkerImageUrl({
  id,
  imageUrl,
}: {
  id: string;
  imageUrl?: string | null;
}): string
```

### `buildAuthorWorkerResolver` の変更

- `image_url: matched.imageUrl ?? null` → `image_url: resolveWorkerImageUrl({ id: matched.id, imageUrl: matched.imageUrl })`
- `AuthorWorkerSchema` の `image_url: nullable()` は変更しない（互換性維持・サーバーが null を返さなくなるが schema は superset を許容）

### クライアントコンポーネントの変更

- `RecentWorkersSection.tsx`: `worker.imageUrl ?? undefined` → `resolveWorkerImageUrl({ id: worker.id, imageUrl: worker.imageUrl })`
- `WorkerTable.tsx`: `worker.imageUrl` → `resolveWorkerImageUrl({ id: worker.id, imageUrl: worker.imageUrl })`

## 5. 影響範囲

- `common/`: `worker.ts`・`worker.test.ts`・`authorWorker.ts`・`authorWorker.test.ts`
- `client/src/components/`: `RecentWorkersSection.tsx`・`WorkerTable.tsx`
- `server/`: 変更なし（`buildAuthorWorkerResolver` が common 経由で変わるだけ）

## 6. テスト計画

### `common` の単体テスト（TDD）

| テスト | 確認内容 |
|--------|----------|
| `generateWorkerAvatarUrl` - URL フォーマット | bottts-neutral を含む DiceBear URL |
| `generateWorkerAvatarUrl` - 決定論的 | 同一 ID → 同一 URL |
| `generateWorkerAvatarUrl` - ユニーク性 | 異なる ID → 異なる URL |
| `resolveWorkerImageUrl` - imageUrl あり | imageUrl をそのまま返す |
| `resolveWorkerImageUrl` - null | DiceBear URL |
| `resolveWorkerImageUrl` - undefined | DiceBear URL |
| `createAvatarUrlResolver` - imageUrl 未設定の既知ワーカー | DiceBear URL（従来は undefined） |
| `buildAuthorWorkerResolver` - imageUrl null | DiceBear URL（従来は null） |

## 7. リスク・未決事項

- DiceBear は外部 API のため、オフライン・CSP・サードパーティ制限環境では画像が読み込まれない可能性がある。ただし MUI Avatar は src 読み込み失敗時にフォールバック（頭文字）表示を維持するため、UX 破綻はない。
- ID に特殊文字が含まれる場合は `encodeURIComponent` で安全にエスケープする。
