# 設計書: client/src/api/subscriptions.ts の fetchSubscriptionStatus を openApiClient 経由に移行する (#1029)

## 1. 目的 / 背景

`client/src/api/subscriptions.ts` の `fetchSubscriptionStatus`（L48-55）が生の `fetch` を使い、レスポンス型を手書きの `{ subscribed: boolean }` として無検証キャストしている。同ファイル内の他関数（`subscribeCommunity`・`unsubscribeCommunity`・`fetchUnreadCounts`）はすべて `openApiClient.POST/DELETE/GET` を使っており、本関数だけが OpenAPI 一方向フローの外側にある。

## 2. スコープ（やること / やらないこと）

**やること:**
- `fetchSubscriptionStatus` を `openApiClient.GET` 経由に移行
- 生の `fetch` 呼び出し・手書き型キャスト・自前エラーハンドリングを削除
- `subscriptions.test.ts` の `fetchSubscriptionStatus` テストを openApiClient パターン（`Request` オブジェクト検証）に更新

**やらないこと:**
- `/api/communities/{slug}/subscription` エンドポイントの仕様変更
- 他の関数（`subscribeCommunity` 等）の変更
- `useSubscriptionStatus` フック等の上位レイヤーへの変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `fetchSubscriptionStatus` が `openApiClient.GET("/api/communities/{slug}/subscription", { params: { path: { slug } }, credentials: "include" })` を呼び出す。
2. 呼び出し時の第一引数が `Request` インスタンスであり、絶対 URL（`/^https?:\/\//` にマッチ）を持つ。
3. 戻り値の型を手書きの `Promise<{ subscribed: boolean }>` から削除し、`unwrap` + openapi.gen.ts から導出する。
4. エラーハンドリングを `unwrap` に統一する（生の `fetch` の `!res.ok` チェックを削除）。
5. 既存テスト（200 成功・4xx・5xx・slug 特殊文字エンコード）が全て緑のまま。
6. `pnpm turbo run build test lint` が緑であること。

## 4. 設計方針

### 移行パターン

```ts
// Before
export async function fetchSubscriptionStatus(slug: string): Promise<{ subscribed: boolean }> {
  const res = await fetch(`/api/communities/${encodeURIComponent(slug)}/subscription`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`GET /api/communities/${slug}/subscription failed: ${res.status}`);
  return res.json() as Promise<{ subscribed: boolean }>;
}

// After
export async function fetchSubscriptionStatus(slug: string) {
  const result = await openApiClient.GET("/api/communities/{slug}/subscription", {
    params: { path: { slug } },
    credentials: "include",
  });
  return unwrap({ result, label: `GET /api/communities/${slug}/subscription` });
}
```

- 戻り値型は `unwrap` の返却型（`NonNullable<T>` where T = openapi.gen.ts の `components["schemas"]["SubscriptionStatus"]`）から自動推論。
- `openApiClient` は path param のエンコードを自動処理するため `encodeURIComponent` の手動呼び出しは不要。
- エラーハンドリングは `unwrap` 内の `error || !response.ok` チェックに委譲。

### テスト変更方針

`openApiClient` は内部で `globalThis.fetch` を経由するため、テストは引き続き `vi.stubGlobal("fetch", ...)` で差し替え可能。ただし openApiClient は `fetch` の第一引数として文字列ではなく `Request` インスタンスを渡すため、テストの検証コードを `Request` オブジェクトパターンに変更する。

## 5. 影響範囲 / 既存への変更

- `client/src/api/subscriptions.ts`: `fetchSubscriptionStatus` の実装のみ変更
- `client/src/api/subscriptions.test.ts`: `fetchSubscriptionStatus` テスト（L83-124）を更新

## 6. テスト計画（TDDで書くテスト一覧）

| # | テストケース | 検証内容 |
|---|-------------|---------|
| 1 | 200 + `{ subscribed: true }` のとき `{ subscribed: true }` を返す | 戻り値 + `Request` インスタンス + 絶対 URL + GET メソッド |
| 2 | 200 + `{ subscribed: false }` のとき `{ subscribed: false }` を返す | 戻り値 |
| 3 | 4xx のとき例外を throw する | unwrap によるエラー検知 |
| 4 | 5xx のとき例外を throw する | unwrap によるエラー検知 |
| 5 | slug に特殊文字が含まれる場合 URL に encodeURIComponent が適用される | `Request.url` でのパスエンコード確認 |

## 7. リスク・未決事項

- `openapi.gen.ts` はビルド生成物（gitignore済み）のため、worktree 上では型チェックが不完全になる。CI の `gen-types → build` パイプラインで型安全性を保証する。
- テストでの openApiClient は `globalThis.fetch` を経由するため、`vi.stubGlobal("fetch", ...)` の stub が有効。これは `client.ts` の `fetch: (...args) => globalThis.fetch(...args)` による遅延束縛の恩恵。
