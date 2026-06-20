# 設計書: ワーカーランキングと閲覧数（PageView）計測を導入する (#665)

## 1. 目的 / 背景

ADR-0032 の決定に従い、ワーカーごとの「読まれている / 伸びている」を vote と閲覧数で可視化する
ランキング画面を追加する。閲覧数は `PageView`（Post/Comment の Exclusive Arc）+
`viewCount` カウンタで計測する（ADR-0031 と同作法）。

## 2. スコープ（やること / やらないこと）

**やること**
- Prisma: `PageView` モデル追加（CHECK + unique 制約付き migration）、`Post.viewCount` / `Comment.viewCount` 追加
- 永続化層: `ViewRepository` ポート + in-memory 実装 + Prisma 実装（TDD）
- Beacon API: `POST /api/posts/:postId/view`・`POST /api/posts/:postId/comment-views`（認証不要）
- 集計 API: `GET /api/workers/ranking`（直近 7 日の views + vote net score を worker 単位集計）
- Client: Post スレッド表示時に `sendBeacon` で post view を送信
- Client: コメント IntersectionObserver + dwell(1s) + sessionStorage dedup + sendBeacon でバッチ送信
- Client: ランキング画面（`/ranking`）を新設、サイドバーにリンク追加
- e2e: `e2e/ranking/usecases.md` 新設、`e2e/usecases.md` 索引に追加

**やらないこと**
- rollup ジョブ（`PageView` raw 行の日次集計・剪定）: 本 Issue スコープ外・負荷顕在化後に別 Issue
- ランキングスコアの単一合成（vote と閲覧数を別々に表示・合成は将来 ADR）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. **スキーマ**: `PageView` モデルが `postId?` / `commentId?` の本物 FK + `userId?` + `sessionId` + `viewedAt` を持つ。マイグレーション SQL に CHECK + `@@unique([postId, sessionId])` / `@@unique([commentId, sessionId])` を含む。`Post.viewCount` / `Comment.viewCount` が `@default(0)` で追加される。
2. **記録ロジック**: 同一 `(target, sessionId)` の二重記録が no-op（行が増えず `viewCount` も増えない）。新規記録で `viewCount` が +1 される。記録と increment は単一トランザクション。
3. **Beacon API**: `POST /api/posts/:postId/view` と `POST /api/posts/:postId/comment-views` が存在する。body validation あり（`sessionId` に `.max()`、`commentIds` に要素上限）。認証不要（ゲスト対応）。
4. **集計 API**: `GET /api/workers/ranking` が `{ workers: [{ workerId, displayName, viewCount, voteNetScore }] }` を返す。直近 7 日ウィンドウ。空状態でも `workers: []` を返す。
5. **クライアント計測**: Post スレッド表示時に post view が 1 回送られる。コメントは 50% 可視 1 秒以上で収集され、sessionStorage dedup の後 sendBeacon でバッチ送信される。セッション内同一コメントは 2 回送信されない。
6. **ランキング画面**: `/ranking` で UC-RANK-01〜03 が確認できる（空状態・一覧表示・vote/views 各数値の表示）。
7. `pnpm turbo run test lint` が全て緑。

## 4. 設計方針

### データモデル
- `PageView` は ADR-0031 の `Vote` と同じ Exclusive Arc パターン
- `sessionId` の max は 256 文字（UUID v4/v7 は 36 文字だが余裕を持たせる）
- `commentIds` の配列上限は 100 要素（1 スレッドで見えるコメント数の上限として十分）

### 永続化層
- `ViewRepository` ポート: `recordPostView` / `recordCommentViews` / `viewsByWorkerSince`
- in-memory 実装は Map で dedup 管理
- Prisma 実装: `prisma.$transaction` で INSERT（ON CONFLICT DO NOTHING 相当 = Prisma の `skipDuplicates: true`）+ `viewCount` increment を原子化

### ビーコン API
- 認証不要（ゲストの閲覧も計測する）
- `userId` は `req.user?.id ?? null`（認証があれば記録、なければ null）
- 202 Accepted を返す（`sendBeacon` はレスポンスを無視する）

### ランキング API
- `GET /api/workers/ranking` を `createWorkersRouter` に追加
- `ViewRepository.viewsByWorkerSince` + `VoteRepository.netScoresByWorkerSince` で集計

実際には vote は community 単位 (`netScoresByCommunitySince`) のため、worker 単位のvote集計は
raw SQL で別実装する。`viewsByWorkerSince` と同じ「UNION ALL で Post/Comment を解決し author で GROUP BY」パターン。
→ VoteRepository に `netScoresByWorkerSince` を追加する（ポート拡張・in-memory と Prisma 両方）

### クライアント
- `usePostViewBeacon(postId)`: マウント時に 1 回 sendBeacon を呼ぶ hook
- `useCommentImpressions(postId)`: コメント要素の ref を受け取り IntersectionObserver + dwell + dedup を管理する hook
- `useWorkerRanking()`: `GET /api/workers/ranking` を呼ぶ TanStack Query hook
- `WorkerRankingScene`: `/ranking` の画面コンポーネント

## 5. 影響範囲 / 既存への変更

| ワークスペース | 変更 |
|---|---|
| server/prisma | schema.prisma に PageView + viewCount 追加、migration 追加 |
| common | PostViewRequestSchema / CommentViewsRequestSchema / WorkerRankingItemSchema 追加 |
| server/src | ViewRepository・PrismaViewRepository 追加、posts.ts 拡張、workers.ts 拡張、app.ts 拡張 |
| client/src | views.ts / ranking.ts 追加、PostThreadScene.tsx 拡張、router.tsx 追加、サイドバーリンク追加 |
| e2e | e2e/ranking/usecases.md 新設、e2e/usecases.md 更新 |

## 6. テスト計画

- `viewRepository.test.ts`: in-memory 実装の dedup・increment ロジック
- `prismaViewRepository.test.ts`: Prisma 実装の統合テスト（DB あり環境のみ実行）
- `posts.test.ts`: beacon API エンドポイントのルートテスト
- `workers.test.ts`: ranking API のルートテスト
- client `useCommentImpressions` の純粋関数部分（dedup ロジック）のユニットテスト

## 7. リスク・未決事項

- `PageView` raw 行は `comments × sessions` で増える。rollup は本 Issue スコープ外だが、早期に負荷が顕在化した場合は別 Issue で対応する。
- `navigator.sendBeacon` は一部環境でブロックされる可能性があるが、計測漏れはプロダクトとして許容範囲（アナリティクス用途のため）。
