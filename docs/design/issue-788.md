# 設計書: client/src/api の fetch エラーハンドリングを unwrap/ensureOk ヘルパーに統一する (#788)

## 1. 目的 / 背景

`client/src/api/client.ts` に定義された `unwrap` / `ensureOk` ヘルパーが既に存在するが、
`votes.ts`・`feed.ts`・`subscriptions.ts`・`posts.ts`・`workers.ts` は手書きの
`if (!response.ok || !data) throw new Error(...)` パターンを使っており、
エラーメッセージ形式やサーバの `{ error: string }` 抽出ロジックがファイルごとに不統一。

## 2. スコープ（やること / やらないこと）

- やること:
  - `votes.ts`（`votePost`・`voteComment`）の手書きチェックを `unwrap` に置換
  - `feed.ts`（`fetchCommunityFeed`・`fetchHomeFeedPage`）を `unwrap` に置換
  - `subscriptions.ts`（`subscribeCommunity`）を `unwrap` に置換
  - `subscriptions.ts`（`unsubscribeCommunity`）を `ensureOk` に置換
  - `posts.ts`（`fetchPostThread`）を `unwrap` に置換
  - `workers.ts`（`useUpdateWorker`）を `unwrap` に置換（`buildApiErrorMessage` import 不要になるため削除）
  - TDD: 置換対象の error 挙動テストを `client/src/api/fetch-error-handling.test.ts` に追加
- やらないこと:
  - `ogp.ts`（`fetchOgp`）: エラー時に throw でなくフォールバック値を返す契約のため変更しない（AC3）
  - `subscriptions.ts`（`fetchSubscriptionStatus`）: raw fetch を使用しており openApiClient 経由でないため変更しない（AC3）
  - `workers.ts`（`useUploadWorkerImage`）: multipart/form-data で raw fetch を直接呼んでおり openApiClient 経由でないため変更しない（AC3）
  - `workers.ts`（`useBotWorkers`）: `if (error) throw new Error(JSON.stringify(error))` は `!response.ok` パターンでなく別系統のため変更しない（AC3）
  - ヘルパー自体（`unwrap` / `ensureOk`）の API 変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `votePost` が 500 のとき `"POST /api/posts/{postId}/vote (500)"` 形式で throw する
2. `voteComment` が 500 のとき `"POST /api/comments/{commentId}/vote (500)"` 形式で throw する
3. `fetchCommunityFeed` が 500 のとき `"GET /api/communities/{slug}/feed (500)"` 形式で throw する
4. `fetchHomeFeedPage` が 500 のとき `"GET /api/feed (500)"` 形式で throw する
5. `subscribeCommunity` が 500 のとき `"POST /api/communities/{slug}/subscribe (500)"` 形式で throw する
6. `unsubscribeCommunity` が 204 のとき throw しない
7. `unsubscribeCommunity` が 500 のとき `"DELETE /api/communities/{slug}/subscribe (500)"` 形式で throw する
8. `fetchPostThread` が 500 のとき `"GET /api/posts/{postId} (500)"` 形式で throw する
9. 各関数は 200 のとき data を返す
10. `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

エラー形式の変化:
- 現在: `` `${method} ${path} failed: ${status}` ``（サーバエラーボディを参照しない）
- 統一後: `buildApiErrorMessage(error, status, label)` → サーバの `{ error: string }` があればそれを使い、なければ `"label (status)"` 形式

各関数の置換パターン:
```typescript
// Before
const { data, response } = await openApiClient.METHOD(path, opts);
if (!response.ok || !data) throw new Error(`${path} failed: ${response.status}`);
return data;

// After
const result = await openApiClient.METHOD(path, opts);
return unwrap(result, `${method} ${path}`);
```

`unsubscribeCommunity`（void 戻り値・空ボディ許容）のみ `ensureOk` を使う:
```typescript
const result = await openApiClient.DELETE(path, opts);
ensureOk(result, `DELETE /api/communities/${slug}/subscribe`);
```

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: client のみ（テスト + 実装）
- 変更ファイル: `votes.ts`・`feed.ts`・`subscriptions.ts`・`posts.ts`・`workers.ts`
- 新規ファイル: `client/src/api/fetch-error-handling.test.ts`
- 既存テストへの影響: `workers.test.tsx` の `useUpdateWorker` テストは `.rejects.toThrow()` のみでメッセージ不問のため影響なし
- エラーメッセージ文言が `"failed: "` から `"(status)"` 形式に変わるが、UI への影響は軽微（ユーザーにはサーバのエラーボディが優先表示される）

## 6. テスト計画（TDD で書くテスト一覧）

| テスト名 | 目的 |
|----------|------|
| votePost 200 → Post を返す | AC9 |
| votePost 500 → label+status 形式で throw | AC1 |
| voteComment 200 → Comment を返す | AC9 |
| voteComment 500 → label+status 形式で throw | AC2 |
| fetchCommunityFeed 200 → Post[] を返す | AC9 |
| fetchCommunityFeed 500 → label+status 形式で throw | AC3 |
| fetchHomeFeedPage 200 → pages を返す | AC9 |
| fetchHomeFeedPage 500 → label+status 形式で throw | AC4 |
| subscribeCommunity 200 → data を返す | AC9 |
| subscribeCommunity 500 → label+status 形式で throw | AC5 |
| unsubscribeCommunity 204 → throw しない | AC6 |
| unsubscribeCommunity 500 → label+status 形式で throw | AC7 |
| fetchPostThread 200 → thread を返す | AC9 |
| fetchPostThread 500 → label+status 形式で throw | AC8 |

## 7. リスク・未決事項

- なし
