# 設計書: client/src/api の位置引数2個の関数をオブジェクト引数（#720）に統一する (#790)

## 1. 目的 / 背景

CLAUDE.md「関数引数規約（#720）」は引数2個以上はオブジェクト引数パターンへの統一を要求し、ESLint `max-params: 1` で強制している。`client/src/api/` の以下の関数が `eslint-disable-next-line max-params` で抑止したまま位置引数を維持している。

- `unwrap(result, label)` / `ensureOk(result, label)` — `client.ts`
- `sendJsonBeacon(url, body)` — `views.ts`（非公開ヘルパー）
- `sendCommentViewsBeacon(postId, commentIds)` — `views.ts`（公開関数）

## 2. スコープ（やること / やらないこと）

**やること:**
- 上記4関数をオブジェクト引数に変更し、`eslint-disable-next-line max-params` を削除する
- すべての呼び出し元（API クライアント・フック・テスト）を新シグネチャに追従させる

**やらないこと:**
- `votes.ts` の `onError`/`onSuccess` 等 TanStack Mutation の外部I/Fコールバック（正当な例外）
- `server/` 側のリファクタ（スコープ外）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `unwrap({ result, label })` の形でオブジェクト引数を受け取る
2. `ensureOk({ result, label })` の形でオブジェクト引数を受け取る
3. `sendCommentViewsBeacon({ postId, commentIds })` の形でオブジェクト引数を受け取る
4. `sendJsonBeacon({ url, body })` の形でオブジェクト引数を受け取る（非公開）
5. 変更後、`eslint-disable-next-line max-params` コメントが4関数から削除されている
6. `pnpm turbo run build test lint` が緑。既存テストの振る舞いは維持する

## 4. 設計方針

### 関数シグネチャの変更

```ts
// client.ts: before → after
unwrap(result: FetchResult<T, E>, label: string): NonNullable<T>
→ unwrap<T, E>({ result, label }: { result: FetchResult<T, E>; label: string }): NonNullable<T>

ensureOk(result: FetchResult<T, E>, label: string): T | undefined
→ ensureOk<T, E>({ result, label }: { result: FetchResult<T, E>; label: string }): T | undefined

// views.ts: before → after
sendJsonBeacon(url: string, body: unknown): void
→ sendJsonBeacon({ url, body }: { url: string; body: unknown }): void

sendCommentViewsBeacon(postId: string, commentIds: string[]): void
→ sendCommentViewsBeacon({ postId, commentIds }: { postId: string; commentIds: string[] }): void
```

### 呼び出し元の更新

`unwrap`/`ensureOk` を使う API モジュール:
- `auth.ts`, `admin.ts`, `batchLogs.ts`, `communities.ts`, `feed.ts`, `posts.ts`
- `subscriptions.ts`, `tokenUsage.ts`, `votes.ts`, `workers.ts`, `workerCommunities.ts`

`sendCommentViewsBeacon` の呼び出し元:
- `views.ts`（内部コールバック l.138）

## 5. 影響範囲 / 既存への変更

- **client**: `client.ts`（実装変更）、`views.ts`（実装変更）、各APIモジュール（呼び出し元修正）
- **テスト**: `client.test.ts`、`views.test.ts`
- **server / common / docs**: 変更なし
- ユーザー可視の振る舞いは変わらない（純粋なリファクタ）

## 6. テスト計画

- `client.test.ts`: `unwrap`/`ensureOk` の全テストをオブジェクト引数形式に更新
- `views.test.ts`: `sendCommentViewsBeacon` の直接呼び出しをオブジェクト引数形式に更新
- 既存テストケースの振る舞いは維持する（新規ケース追加なし）

## 7. リスク・未決事項

- `unwrap`/`ensureOk` は多数のAPIモジュールから使われているため、変更漏れがないよう `grep` で全呼び出し元を確認してから実装する
- `sendJsonBeacon` は非公開関数のため、`views.ts` 内の2箇所のみ変更すればよい
