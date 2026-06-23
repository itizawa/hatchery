# 設計書: vote ウィジェットの表示スコアを up − down のネット値（score）に戻す (#856)

## 1. 目的 / 背景

Issue #814 で `VoteControl` の表示数字を `up_count`（up vote の累計件数）に変更した。
しかし `score`（up − down のネット値、負値あり）に戻したい。
`score` は ADR-0030・ADR-0032 で引き続きコミュニティ重み付けやワーカーランキングに使われており意味は変わらない。
`up_count` は表示専用で他用途がないため、全スタックから削除する（後述「やること」参照）。

## 2. スコープ（やること / やらないこと）

### やること
- `client/src/components/VoteControl.tsx`: `upCount` prop 削除、`displayCount = score` に統一
- `client/src/components/PostCard.tsx`: `upCount={post.up_count}` 削除
- `client/src/components/CommentCard.tsx`: `upCount={comment.up_count}` 削除
- `client/src/api/votes.ts`: `up_count` の楽観更新・サーバ確定値反映をすべて削除
- `client/src/components/VoteControl.test.tsx`: `upCount` テスト削除、score 表示テストに更新
- `common/src/domain/post/post.ts`: `PostSchema` から `up_count` フィールド削除
- `common/src/domain/comment/comment.ts`: `CommentSchema` から `up_count` フィールド削除
- `server/src/routes/postResponse.ts`: `up_count` マッピング削除
- `server/src/persistence/prismaVoteRepository.ts`: `upCountDelta` 計算・`upCount: { increment: upCountDelta }` 削除
- `server/src/persistence/postRepository.ts`: `PostRecord.upCount` 削除、InMemory 実装も更新
- `server/src/persistence/commentRepository.ts`: `CommentRecord.upCount` 削除、InMemory 実装も更新
- `server/src/persistence/prismaPostRepository.ts`: `toRecord` から `upCount` 削除
- `server/src/persistence/prismaCommentRepository.ts`: `toRecord` から `upCount` 削除
- `server/prisma/schema.prisma`: Post / Comment の `upCount` フィールド削除
- Prisma migration: `upCount` DROP 移行ファイル作成
- `e2e/` のユースケース更新（UC-HOME-22 / UC-POST-21）

### やらないこと
- vote ツールチップで「up N / down M」表示（別 Issue）
- ゲスト vote 機能の追加（別 Issue）
- `voteAndApplyScore` の `applyScore` コールバック除去（スコープ外）

### up_count 維持/削除の判断
`up_count` は現在 display 専用で他用途がない（ADR-0030 の重み付けは `score` を使う）。
維持するメリットがないため全スタック削除を選択する。
将来「up N / down M」をツールチップ表示したい場合は別 Issue で up_count / down_count の再追加を検討する。

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `VoteControl` の表示数字が `score`（負値あり）になる。`upCount` prop は型として存在しない。
2. `score=-2, upCount=5` のとき、`upCount` prop なしの `VoteControl` は `-2` を表示する。
3. `score=-3` のとき `VoteControl` は `-3` を表示する。
4. `PostCard` / `CommentCard` が `VoteControl` に `upCount` prop を渡さない。
5. `votes.ts` の楽観更新で `up_count` を更新しない（score のみ更新）。
6. `pnpm turbo run test lint` が緑。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- **一方向フロー維持**: common Zod スキーマから `up_count` を削除 → server openapi.json 再生成 → client 型生成の順で反映。
- **Prisma migration**: カラム DROP は後退不可（本番 DB 適用後は戻せない）。migration 名: `20260623000000_drop_up_count`。
- **InMemory 実装**: テスト用 InMemory リポジトリも `upCount: 0` 初期値を削除する。
- **votes.ts の楽観更新**: `calcOptimisticPostVote` の `VoteFields` から `up_count` を外す。score のみ楽観更新し、`up_count` のキャッシュ書き込みも除去する。

## 5. 影響範囲 / 既存への変更

| ワークスペース | 変更内容 |
|---|---|
| common | PostSchema / CommentSchema の `up_count` フィールド削除 |
| server | postResponse.ts の `up_count` マッピング削除、voteRepository の `upCountDelta` 削除、postRepository / commentRepository の `upCount` フィールド削除、Prisma schema / migration |
| client | VoteControl の `upCount` prop 削除、PostCard / CommentCard 呼び出し更新、votes.ts の楽観更新更新、VoteControl.test.tsx 更新 |
| e2e | UC-HOME-22 / UC-POST-21 のユースケース文字列・spec.ts を更新 |

## 6. テスト計画（TDD で書くテスト一覧）

`VoteControl.test.tsx` を更新:
- score が負値（-2）でも正しく表示される（`upCount` prop なし）
- `upCount` prop なしで score=0 が表示される
- 既存の "up_count を中央に表示する（#814）" テストを削除し score テストに置き換える

server のテスト:
- `postResponse.test.ts`: `up_count` フィールドが API レスポンスに含まれないことを確認
- `voteRepository.test.ts`: `upCountDelta` が計算されなくなること（既存テストの調整）

## 7. リスク・未決事項

- Prisma migration による `upCount` カラム DROP は本番 DB 適用後に後退不可。データは失われるが display 専用だったため業務影響なし。
- 本番 DB に既存 `upCount` データが蓄積されているが削除しても機能に影響なし。
