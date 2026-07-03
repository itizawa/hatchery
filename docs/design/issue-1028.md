# 設計書: client/src/api/communities.ts の fetchRecentWorkers を openApiClient 経由に移行する (#1028)

## 1. 目的 / 背景

`client/src/api/communities.ts` の `fetchRecentWorkers`（L224-236）は生の `fetch` を使い、レスポンス型を手書きの `RecentWorker` 型として無検証でキャストしている。

CLAUDE.md が定める OpenAPI 一方向フロー（common Zod → server openapi.json → client 型生成 → openApiClient 利用）から、この関数だけが外れている状態を解消する。

コメントにあった「移行の前提条件」（#372）は既に満たされており（openapi.gen.ts に型定義が生成済み、#372 クローズ済み）、移行可能な状態になっている。

## 2. スコープ（やること / やらないこと）

**やること:**
- `fetchRecentWorkers` を `openApiClient.GET("/api/communities/{slug}/recent-workers", ...)` に移行する
- 手書きの `RecentWorker` 型定義を削除し、`components["schemas"]["Worker"]` の型エイリアスに置き換える（既存 export を維持して後方互換を保つ）
- 古いコメント（`#372` 参照・移行前提の説明）を削除する
- `communities.test.ts` の `fetchRecentWorkers` テストを `openApiClient.GET` パターン（Request オブジェクト）に更新する

**やらないこと:**
- `recent-workers` エンドポイント自体の仕様変更
- 他の API 関数の変更
- `RecentWorker` 型を import している他のファイル（`RecentWorkersSection.tsx` 等）の変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `fetchRecentWorkers` の実装が `openApiClient.GET("/api/communities/{slug}/recent-workers", { params: { path: { slug } }, credentials: "include" })` を使う形に置き換えられている
2. 戻り値の型が手書きの `RecentWorker` ではなく `components["schemas"]["Worker"][]` から導出されている（`RecentWorker` は型エイリアスとして維持）
3. `eslint-disable` コメントと古い移行前提コメント（`#372` 参照）が削除されている
4. `communities.test.ts` の `fetchRecentWorkers` テストが `openApiClient.GET` パターン（`Request` オブジェクトで URL を確認）に更新されている
5. `pnpm turbo run build|test|lint` が緑であること

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### 型エイリアスによる後方互換

`RecentWorker` は複数ファイル（`RecentWorkersSection.tsx`、`CommunityScene.test.tsx`、`fixtures.ts`）から import されているため、削除すると広範囲の変更が必要になる。

しかし手書きの型定義を削除し `components["schemas"]["Worker"]` の型エイリアスとして公開することで、既存 import を維持しながら「手書き型ではなくスキーマから導出」という目標を達成できる。

```ts
// Before（手書き型）
export type RecentWorker = {
  id: string;
  displayName: string;
  role?: string | null;
  imageUrl?: string | null;
};

// After（型エイリアス）
export type RecentWorker = components["schemas"]["Worker"];
```

`Worker` スキーマ（WorkerSchema）は `id`, `displayName`, `role?`, `personality?`, `verbosity?`, `imageUrl?`, `deletedAt?` を持ち、既存のモックデータ（`{ id, displayName, role? }` の形）は `Worker` 型を満たすため後方互換がある。

### `fetchRecentWorkers` の実装変更

```ts
// Before（生 fetch）
export async function fetchRecentWorkers(slug: string): Promise<RecentWorker[]> {
  const res = await fetch(`/api/communities/${encodeURIComponent(slug)}/recent-workers`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`...`);
  return res.json() as Promise<RecentWorker[]>;
}

// After（openApiClient 経由）
export async function fetchRecentWorkers(slug: string): Promise<RecentWorker[]> {
  const result = await openApiClient.GET("/api/communities/{slug}/recent-workers", {
    params: { path: { slug } },
    credentials: "include",
  });
  return unwrap({ result, label: `GET /api/communities/${slug}/recent-workers` });
}
```

### テストの更新

`openApiClient.GET` は `globalThis.fetch` を経由するため、`vi.stubGlobal("fetch", fetchMock)` のスタブは引き続き有効。ただし呼び出し形式が `fetch(url, init)` から `fetch(Request)` に変わるため、アサーション形式を他の `openApiClient.GET` テスト（`fetchAdminCommunities` 等）と同様のパターンに合わせる。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client）

- `client/src/api/communities.ts`: `fetchRecentWorkers` 実装変更、`RecentWorker` 型エイリアス化
- `client/src/api/communities.test.ts`: `fetchRecentWorkers` テスト更新

変更なし: `RecentWorkersSection.tsx`、`CommunityScene.test.tsx`、`fixtures.ts`（型エイリアスにより後方互換）

## 6. テスト計画（TDD で書くテスト一覧）

1. `fetchRecentWorkers` 200 応答 → Worker 一覧を返す（Request.url でパス確認）
2. `fetchRecentWorkers` エラー応答 → 例外を投げる

## 7. リスク・未決事項

- `openapi.gen.ts` は生成物のためコミット対象外。CI 環境では `pnpm gen-types` で生成される。型が合わない場合でも CI ビルドで検出される。
- `Worker` 型は `RecentWorker` の手書き型より厳密（`role?: string` vs `role?: string | null`）。既存モックデータに null を使っているケースがないことを確認済み（影響なし）。
