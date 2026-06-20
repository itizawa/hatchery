# 設計書: vote ボタン連打を isPending で防止してリクエストの多重送信を防ぐ (#748)

## 1. 目的 / 背景

vote ボタン（up/down）を素早く連打すると、ミューテーション進行中に複数の API リクエストが送信されてしまう。
各シーンで `useVotePost` / `useVoteComment` の `isPending` を取得していないため、`PostCard` / `CommentCard` の `voteDisabled` prop に渡せていないことが原因。

## 2. スコープ（やること / やらないこと）

**やること:**
- `PostThreadScene.tsx`・`HomeFeedScene.tsx`・`CommunityScene.tsx` で `isPending` を取得し `voteDisabled` prop に渡す
- `PostCard.test.tsx`・`CommentCard.test.tsx` に「`voteDisabled={true}` のとき vote ボタンが disabled になる」テストを追加

**やらないこと:**
- `VoteControl.tsx`・`PostCard.tsx`・`CommentCard.tsx` のインターフェース変更（既に対応済み）
- per-item 独立 pending 管理（1 フック共有の仕様は維持）

## 3. 受け入れ条件（テストに落とせる粒度）

1. `PostCard.test.tsx` / `CommentCard.test.tsx`: `voteDisabled={true}` で両ボタンが disabled になること
2. `PostThreadScene.tsx`: `useVotePost()` から `isPending: isVotingPost`、`useVoteComment(id)` から `isPending: isVotingComment` を取得し、PostCard に `voteDisabled={isVotingPost}`、renderCommentTree 内の CommentCard に `voteDisabled={isVotingComment}` を渡す
3. `HomeFeedScene.tsx`: `useVotePost()` から `isPending: isVotingPost` を取得し、PostCard に `voteDisabled={isVotingPost}` を渡す
4. `CommunityScene.tsx` の `CommunityContent`: `useVotePost(communitySlug)` から `isPending: isVotingPost` を取得し、PostCard に `voteDisabled={isVotingPost}` を渡す
5. `pnpm turbo run build test lint` が緑

## 4. 設計方針

### 変更範囲

| ファイル | 変更内容 |
|---------|----------|
| `client/src/routes/PostThreadScene.tsx` | `isPending: isVotingPost` / `isVotingComment` を destructure し、PostCard・renderCommentTree に渡す |
| `client/src/routes/HomeFeedScene.tsx` | `isPending: isVotingPost` を destructure し、PostCard に渡す |
| `client/src/routes/CommunityScene.tsx` | `CommunityContent` の `isPending: isVotingPost` を destructure し、PostCard に渡す |
| `client/src/components/PostCard.test.tsx` | `voteDisabled={true}` テストを追加 |
| `client/src/components/CommentCard.test.tsx` | `voteDisabled={true}` テストを追加 |

### ミューテーション共有の挙動

1 シーン内で `useVotePost` / `useVoteComment` は 1 インスタンス。`isPending` は「そのシーン内で何らかの vote が進行中」を表す。同シーン内の全カードのボタンが一括で無効化される（per-item 制御は将来拡張）。

## 5. 影響範囲

対象ワークスペース: **client** のみ。server / common / docs への変更なし。

## 6. テスト計画

- `PostCard.test.tsx`: `voteDisabled={true}` のとき up/down ボタンが `toBeDisabled()` になること
- `CommentCard.test.tsx`: 同上
- `VoteControl.test.tsx`: `disabled=true` テストは既存（追加不要）

## 7. リスク・未決事項

- per-item pending 管理（カードごとに独立した disabled 状態）は本 Issue のスコープ外。将来 Issue で対応。
