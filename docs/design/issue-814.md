# 設計書: vote ウィジェットの表示数を純スコアから up vote 件数のみに変更する (#814)

## 1. 目的 / 背景

現状の `VoteControl` が表示する数字は `score`（up − down のネット値）。
ユーザーは「up vote の累計件数」を見たい。
ネット `score` は community 重み付け（ADR-0030）と worker ランキング（ADR-0032）に使用されるため意味を変えられない。
そのため `upCount` を別途 denormalize して保持し、表示のみを切り替える。

## 2. スコープ（やること / やらないこと）

### やること

- `PostSchema` / `CommentSchema` に `up_count` フィールドを追加（Zod）
- `Post` / `Comment` テーブルに `upCount` カラムを追加（Prisma migration）
- `voteAndApplyScore` 内で `upCount` を `score` と同一トランザクションで増減
- `toPostResponse` / `toCommentResponse` に `up_count` を含める
- `VoteControl` の表示数字を `score` → `up_count` に変更
- `useVotePost` / `useVoteComment` の楽観的更新で `up_count` も更新
- e2e usecases に「ウィジェットの数字は up 件数を表す」を追記

### やらないこと

- 人気フィード / 重み付け / ランキングの `score` 利用ロジックの変更
- vote 済みの塗り表示（#813 のスコープ）
- ツールチップ（#755）
- ゲスト vote（#777）の追加変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `PostSchema.parse({})` で `up_count` のデフォルト値が `0` になる
2. `PostSchema.parse({ up_count: -1 })` が reject される（nonnegative 制約）
3. `CommentSchema.parse({})` で `up_count` のデフォルト値が `0` になる
4. `voteAndApplyScore`（未投票→up）で `upCount` が +1 される
5. `voteAndApplyScore`（up→toggle off）で `upCount` が -1 される
6. `voteAndApplyScore`（down→up switch）で `upCount` が +1 される
7. `voteAndApplyScore`（up→down switch）で `upCount` が -1 される
8. `toPostResponse` が `up_count` フィールドを含む
9. `toCommentResponse` が `up_count` フィールドを含む
10. `VoteControl` が `up_count` を表示する（`score` ではない）
11. 楽観更新（useVotePost）で up 押下時に `up_count` が +1 される

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### upCount の永続化方式

推奨方式（**migration 方式**）を採用する。

`Vote` テーブルから毎回集計する代替方式は読み取りコスト（N+1・集計クエリ）が高い。
`score` と同様にカラムとして denormalize し、vote トランザクション内で増減することで
読み取り側は単純な SELECT のみで up_count が取得できる。

### upCount の増減ルール

| 遷移 | scoreDelta | upCountDelta |
|------|-----------|-------------|
| 未投票 → up | +1 | +1 |
| up → 未投票（toggle off）| -1 | -1 |
| 未投票 → down | -1 | 0 |
| down → 未投票（toggle off）| +1 | 0 |
| up → down（switch）| -2 | -1 |
| down → up（switch）| +2 | +1 |

### 楽観的更新（votes.ts）

現在の楽観更新は `score` のみを更新している。
`up_count` も同じロジックで更新する必要があるが、
楽観更新時点では「現在の vote 状態」を保持していないため、
direction だけを見て単純に +1/-1 するのは不正確になる。
→ 楽観更新は「up 押下は up_count +1、up 解除（toggle）は up_count -1、down 押下/解除は 0 変化」と近似する。
実際の vote 状態は `onSettled` の invalidate で修正される。

実態としてはサーバ応答後に invalidate が走るため、楽観更新の精度より UX の応答性を優先するのは既存の `score` 楽観更新と同じ考え方。

受け入れ条件 #11 は「up 押下時 up_count +1」のみとし、正確な値は invalidate 後のサーバ応答が担保する。

## 5. 影響範囲 / 既存への変更（対象ワークスペース）

| ファイル | 変更内容 |
|---------|----------|
| `common/src/domain/post/post.ts` | `PostSchema` に `up_count` フィールド追加 |
| `common/src/domain/post/post.test.ts` | `up_count` テスト追加 |
| `common/src/domain/comment/comment.ts` | `CommentSchema` に `up_count` フィールド追加 |
| `common/src/domain/comment/comment.test.ts` | `up_count` テスト追加 |
| `server/prisma/schema.prisma` | `Post.upCount` / `Comment.upCount` カラム追加 |
| `server/src/persistence/postRepository.ts` | `PostRecord` に `upCount` フィールド追加 |
| `server/src/persistence/commentRepository.ts` | `CommentRecord` に `upCount` フィールド追加 |
| `server/src/persistence/prismaVoteRepository.ts` | `voteAndApplyScore` で `upCount` 更新を追加 |
| `server/src/persistence/prismaPostRepository.ts` | `upCount` をセレクト/マップに追加 |
| `server/src/persistence/prismaCommentRepository.ts` | `upCount` をセレクト/マップに追加 |
| `server/src/routes/postResponse.ts` | `toPostResponse` / `toCommentResponse` に `up_count` 追加 |
| `server/src/routes/postResponse.test.ts` | `up_count` テスト追加 |
| `client/src/components/VoteControl.tsx` | 表示を `score` → `up_count` に変更 |
| `client/src/api/votes.ts` | 楽観更新に `up_count` 更新を追加 |
| `e2e/home-feed/usecases.md` | UC-HOME-22 追加 |
| `e2e/post-thread/usecases.md` | UC-POST-xx 追加 |
| `e2e/usecases.md` | 更新 |

## 6. テスト計画（TDD で書くテスト一覧）

### common

- `PostSchema` で `up_count` のデフォルト 0
- `PostSchema` で `up_count` 負数を reject
- `CommentSchema` で `up_count` のデフォルト 0
- `CommentSchema` で `up_count` 負数を reject

### server（unit / integration）

- `toPostResponse` に `up_count` が含まれること
- `toCommentResponse` に `up_count` が含まれること
- `voteAndApplyScore`: 各遷移（4 ケース）で `upCountDelta` が正しいこと

### client（unit）

- `VoteControl` が `up_count` prop を表示すること
- `useVotePost`: 楽観更新で up 押下時 `up_count` が +1 されること

## 7. リスク・未決事項

- Prisma migration は DB 環境が必要。CI では `DATABASE_URL` が未設定のため integration テストは `describe.skipIf(!DATABASE_URL)` で skip される（既存のパターンに合わせる）。
- 楽観更新の `up_count` 計算は近似値（toggle off の検出ができないため）。正確な値はサーバ応答後の invalidate が担保する。
- 既存データの `upCount` は `0` で初期化される（実際の vote 件数と乖離が生じる）。これは受け入れ済みのトレードオフ。将来バックフィルが必要なら別 Issue とする。
