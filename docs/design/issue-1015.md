# 設計書: 死んでいる source.boringavatars.com への依存を解消し boring-avatars React コンポーネント方式に変更する (#1015)

## 1. 目的 / 背景

`source.boringavatars.com` はサービス終了済み（SSL 証明書 2024-10-19 期限切れ・Vercel デプロイ削除済み）。
PR #1005（#959）で導入したワーカーアバターの URL 方式が前提から誤っており、本番で全ワーカーのデフォルトアバターが壊れた画像アイコンとして表示されている。

## 2. スコープ（やること / やらないこと）

**やること:**
- `common`: `generateWorkerAvatarUrl`（および `BORING_AVATARS_BASE_URL`）を廃止。`resolveWorkerImageUrl` は imageUrl が null/undefined のとき `null` を返す
- `client`: `boring-avatars` npm パッケージを追加し、`WorkerAvatar` コンポーネントを新設。imageUrl=null のとき SVG をクライアントサイドで描画
- 既存 7 か所（`WorkerImageUpload.tsx`, `WorkerTable.tsx`, `RecentWorkersSection.tsx`, `AuthorByline.tsx`, `CommentCard.tsx` 2 箇所, `WorkerScene.tsx`, `WorkerRankingScene.tsx`）を `WorkerAvatar` に置換
- server テスト・common テスト・client テストの期待値を新仕様に合わせて更新

**やらないこと:**
- boring-avatars のカラーパレットを `SLACK_COLORS` に統一する対応（別 Issue）
- `WORKER_AVATAR_URL_MAX_LENGTH` 定数の削除（#592 の「将来の利用に備えて保持」方針を踏襲）
- community アイコン側（`source.boringavatars.com` 依存）の同種の修正（別 Issue #1021）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `boring-avatars` パッケージが `client` の dependencies に追加されている
2. `resolveWorkerImageUrl({ id, imageUrl: null })` は `null` を返す（URL を捏造しない）
3. `resolveWorkerImageUrl({ id, imageUrl: "https://..." })` はそのまま URL を返す
4. `generateWorkerAvatarUrl` は廃止済みで export されない
5. `WorkerAvatar` コンポーネント: imageUrl 非 null → MUI Avatar + src 属性あり
6. `WorkerAvatar` コンポーネント: imageUrl null → boring-avatars SVG 描画（img タグなし）・wrapper に `role="img"` あり
7. client の 7 か所で `resolveWorkerImageUrl` が使われていない
8. server テスト: imageUrl=null のワーカーの `author_worker.image_url` が `null` になる
9. `pnpm turbo run build test lint` が緑

## 4. 設計方針

### common 変更

`resolveWorkerImageUrl` の戻り値を `string | null` に変更:
```ts
// Before: imageUrl なし → boringavatars URL 文字列
// After:  imageUrl なし → null
export function resolveWorkerImageUrl({ id: _id, imageUrl }: { id: string; imageUrl?: string | null }): string | null {
  return imageUrl ?? null;
}
```

`generateWorkerAvatarUrl` と `BORING_AVATARS_BASE_URL` は削除する。

`createAvatarUrlResolver` の戻り値型は `string | null | undefined` に変わる（`null` = imageUrl 未設定の既知ワーカー、`undefined` = 未解決 ID）。

`authorWorker.ts` の `buildAuthorWorkerResolver` は `resolveWorkerImageUrl` を使うが、`AuthorWorkerSchema.image_url` は既に `nullable()` のため型の変更は最小限。

### client 変更

`WorkerAvatar` コンポーネント（`client/src/components/WorkerAvatar.tsx`）を新設:
```tsx
interface WorkerAvatarProps {
  id: string;
  imageUrl?: string | null;
  size: number;
  alt?: string;
  displayName?: string;
  sx?: Record<string, unknown>;
}
```
- imageUrl 非 null → MUI Avatar の src に渡す
- imageUrl null → `<Box role="img" aria-label={alt}>` で boring-avatars Avatar を内包

### 影響範囲

- `common/src/domain/worker/worker.ts`（実装変更）
- `common/src/domain/worker/worker.test.ts`（テスト更新）
- `server/src/routes/authorWorker.test.ts`（期待値更新）
- `server/src/routes/feed.test.ts`（期待値更新）
- `server/src/routes/posts.test.ts`（期待値更新）
- `client/package.json`（boring-avatars 追加）
- `client/src/components/WorkerAvatar.tsx`（新設）
- `client/src/components/WorkerAvatar.test.tsx`（新設）
- `client/src/components/WorkerImageUpload.tsx`
- `client/src/components/WorkerTable.tsx`
- `client/src/components/RecentWorkersSection.tsx`
- `client/src/components/AuthorByline.tsx`
- `client/src/components/CommentCard.tsx`
- `client/src/routes/WorkerScene.tsx`
- `client/src/routes/WorkerRankingScene.tsx`
- `client/src/components/AuthorByline.test.tsx`（期待値更新）
- `client/src/components/CommentCard.test.tsx`（期待値更新）
- `client/src/components/WorkerTable.test.tsx`（期待値更新）
- `client/src/components/WorkerImageUpload.test.tsx`（期待値更新）

## 5. 影響範囲 / 既存への変更（対象ワークスペース）

- `common`: `resolveWorkerImageUrl` 戻り値型変更（breaking change だが caller はすべて `string | null` を受け入れられる）
- `server`: 実装変更なし（テストのみ更新）
- `client`: 新コンポーネント追加 + 7 か所の呼び出し側変更

## 6. テスト計画（TDD で書くテスト一覧）

### common テスト更新
- `resolveWorkerImageUrl` imageUrl null → null を返す
- `resolveWorkerImageUrl` imageUrl undefined → null を返す
- `resolveWorkerImageUrl` imageUrl あり → そのまま返す
- `createAvatarUrlResolver` imageUrl 未設定 → null を返す
- `generateWorkerAvatarUrl` は存在しない（import できない）

### server テスト更新
- `authorWorker.test.ts`: imageUrl=null のワーカーの `image_url` が `null` になる
- `feed.test.ts`: imageUrl=null のワーカーの `image_url` が `null` になる
- `posts.test.ts`: imageUrl=null のワーカーの `image_url` が `null` になる

### client テスト新設（WorkerAvatar.test.tsx）
- imageUrl 非 null → MUI img 要素の src が正しい
- imageUrl null → img タグなし、wrapper に role="img" あり

### client テスト更新
- `AuthorByline.test.tsx`: image_url null → img タグなし（src 属性なし）、boring-avatars wrapper あり
- `CommentCard.test.tsx`: 同上
- `WorkerTable.test.tsx`: imageUrl 未設定 → boring-avatars wrapper あり
- `WorkerImageUpload.test.tsx`: currentImageUrl=null → boring-avatars wrapper あり

## 7. リスク・未決事項

- boring-avatars の TypeScript 型定義が不十分な場合、型宣言ファイル（`boring-avatars.d.ts`）を追加する可能性あり
- boring-avatars の `beam` スタイルが jsdom（テスト環境）で SVG をどう描画するかに依存するため、テストはレンダリング内容ではなく構造（role/tagName）を検証する
