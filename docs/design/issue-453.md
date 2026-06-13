# Issue #453 設計: Vote の多態参照を Exclusive Arc（postId/commentId 本物FK + CHECK）へ移行する

## 背景・目的

`Vote` は現在 `targetType`（post/comment）+ `targetId`（FK なし）の**多態参照**で投票対象を表す。これには
存在保証なし・cascade なし・vote 作成と score 更新の非トランザクション、という整合性リスクがある。

投票対象は Post / Comment の 2 種で固定（ADR 上も増える予定なし）なので、**Exclusive Arc**
（`postId?` / `commentId?` をそれぞれ本物 FK にし CHECK 制約でちょうど片方だけ非 null を強制）へ移行し、
整合性を DB の参照整合性 + CHECK 制約で構造的に担保する。

## 設計判断

### 1. スキーマ（`server/prisma/schema.prisma`）

- `Vote` から `targetType` / `targetId` と `VoteTargetType` enum を廃止。
- `postId String?` + `commentId String?` を追加し、それぞれ `Post` / `Comment` へ
  `@relation(..., onDelete: Cascade)`。`Post` / `Comment` 側に逆リレーション `votes Vote[]` を追加。
- 二重投票防止のユニーク制約を `@@unique([userId, postId])` / `@@unique([userId, commentId])` に置換。
  （PostgreSQL では NULL は一意制約上区別されるため、post 票と comment 票が混在しても問題ない。）
- CHECK 制約（ちょうど片方だけ非 null）は Prisma スキーマ宣言不可のため、`--create-only`
  生成後にマイグレーション SQL を手編集して追加する。

### 2. マイグレーション（データ移行を同一ファイルに含める）

`prisma migrate dev --create-only` で骨子を生成し、次の順で手編集する（受け入れ条件 2・3）:

1. `postId` / `commentId` カラム追加（nullable）。
2. backfill: `UPDATE "Vote" SET "postId" = "targetId" WHERE "targetType" = 'post'` /
   `... SET "commentId" = "targetId" WHERE "targetType" = 'comment'`。
3. 旧ユニーク制約 / index / `targetType` / `targetId` カラム / `VoteTargetType` enum を drop。
4. FK 制約（`onDelete CASCADE`）・新ユニーク制約・CHECK 制約
   `CHECK ((("postId" IS NOT NULL)::int + ("commentId" IS NOT NULL)::int) = 1)` を追加。

backfill をカラム drop の前に同一マイグレーション内で行うことで stg/prod の既存 vote を欠損なく移行する。

### 3. 永続化層（ポートは現状維持・実装裁量）

`VoteRepository` の公開インターフェース（`server/src/persistence/voteRepository.ts`）は
`(targetType, targetId)` セマンティクスのまま**維持**する。これにより in-memory 実装・`posts.ts`・
バッチ（`netScoresByCommunitySince` 利用）・既存テストの blast radius を最小化する（受け入れ条件 8）。

Prisma 実装（`prismaVoteRepository.ts`）が `targetType`/`targetId` ⇔ `postId`/`commentId` をマップする:
- `findVote` / `vote`: `targetType==="post"` のとき `{ postId: targetId }`、`comment` のとき `{ commentId: targetId }` を where / data に使う。
- ユニーク where は `userId_postId` / `userId_commentId` 複合キーを使い分ける。
- `netScoresByCommunitySince` は `postId` / `commentId` の本物 FK 経由 JOIN に書き換える。

### 4. vote と score 更新の単一トランザクション（受け入れ条件 7）

`VoteRepository` に新メソッド `voteAndApplyScore(userId, targetType, targetId, direction)` を追加する:
- 戻り値 `{ scoreDelta: number; score: number | null }`（score は更新後の対象スコア。対象が無ければ null）。
- Prisma 実装は `prisma.$transaction` 内で「vote の create/update/delete」＋「Post/Comment の score increment」を
  まとめて実行し、片方だけ成功する中間状態を排除する。
- in-memory 実装は score を加算する `applyScoreDelta` コールバックを DI で受け取り同期的に整合させる。

`posts.ts` の vote ハンドラを `voteRepo.vote(...).then(addScore)` の 2 段から
`voteRepo.voteAndApplyScore(...)` の 1 呼び出しへ置き換える。既存 `vote()` メソッドは後方互換のため残す。

### 5. HTTP 境界・型共有（受け入れ条件 9）

vote エンドポイントは URL パス（`/posts/:postId/vote`・`/comments/:commentId/vote`）で対象が決まるため、
リクエスト/レスポンス契約（`VoteRequestSchema` / `{ score }` レスポンス）は不変。common Zod / `openapi.json` /
client 型に影響なし（ユーザー可視の振る舞いも不変 → e2e ユースケース更新は不要）。

### 6. ADR（受け入れ条件 10）

新規 ADR-0031 を追加し、ADR-0019 / ADR-0025 の「多態参照 (target_type, target_id) で vote を持つ」決定を
Exclusive Arc で supersede する。`docs/adr/README.md` 一覧に行を追加し、ADR-0019/0025 に supersede 注記を入れる。

## 受け入れ条件 → 入出力（テスト）

| AC | テスト |
|----|--------|
| 4 二重投票防止 | in-memory / Prisma 統合: 同一ユーザー×同一ターゲットで 1 レコードに収束 |
| 5 存在しない対象は FK 違反 | Prisma 統合: 存在しない postId/commentId への vote が例外 |
| 6 cascade 削除 | Prisma 統合: Post/Comment 削除で関連 vote が消える |
| 7 単一トランザクション | in-memory / Prisma: `voteAndApplyScore` が scoreDelta と更新後 score を返し整合 |
| 8 vote 振る舞い不変 | 既存 in-memory / route / Prisma テスト緑のまま（scoreDelta マトリクス不変） |
| 9 HTTP 契約不変 | 既存 posts route テスト緑のまま・openapi 差分なし |

## スコープ外

- 投票対象 3 種以上への拡張（共通親テーブル / CTI）は本 Issue では扱わない（Post/Comment 2 種前提）。
