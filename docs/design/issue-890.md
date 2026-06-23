# 設計書: vote 進行中は押したボタンのみ disabled にし、もう一方のボタンは操作可能にする (#890)

## 1. 目的 / 背景

Issue #748 で連打防止のため `isPending` をそのまま `disabled` に渡した結果、vote リクエスト送信中に up/down 両ボタンが同時に disabled になる問題が発生している。up を押してリクエスト中でも down は押せる（意味のある操作）はずなので、押した方向のボタンだけを disabled にする UX 改善を行う。

## 2. スコープ（やること / やらないこと）

**やること:**
- `VoteControl` の `disabled` 単一 prop を `upDisabled` / `downDisabled` の 2 prop に分割
- `PostCard` / `CommentCard` の `voteDisabled` prop を `upVoteDisabled` / `downVoteDisabled` に変更
- 各シーン（HomeFeedScene / CommunityScene / PostThreadScene）で `useMutation` の `variables` を使ってペンディング方向を特定し、方向別 disabled を渡す

**やらないこと:**
- 異なる post/comment 間でのペンディング管理（per-item pending は #748 スコープ外）
- アイコン形状・配色変更（別 Issue #854 対応）
- VoteControl 以外の UI 変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `VoteControl`: `upDisabled=true` のとき up ボタンのみ disabled、down は enabled。`downDisabled=true` のとき下ボタンのみ disabled、up は enabled。両方 false（デフォルト）のとき両方 enabled。
2. `PostCard`: `upVoteDisabled=true` のとき up ボタンのみ disabled。`downVoteDisabled=true` のとき down ボタンのみ disabled。
3. `CommentCard`: `PostCard` と同様。
4. 各シーンで `votingPostVars?.direction === "up"` なら `upVoteDisabled=true` のみが PostCard に渡る。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

TanStack Query の `useMutation` は最後のミューテーション引数を `variables` として公開する。`isPending && variables?.direction === "up"` で up ボタンのみを disabled にできる。

```
useMutation variables: { postId: string; direction: VoteDirection } | undefined
↓
isPending && variables?.direction === "up"  →  upVoteDisabled=true
isPending && variables?.direction === "down" →  downVoteDisabled=true
```

### コンポーネント階層の変更

```
VoteControl: disabled → upDisabled / downDisabled
PostCard:    voteDisabled → upVoteDisabled / downVoteDisabled → VoteControl へ
CommentCard: voteDisabled → upVoteDisabled / downVoteDisabled → VoteControl へ
HomeFeedScene/CommunityScene/PostThreadScene:
  const { mutate, isPending, variables } = useVotePost(...)
  upVoteDisabled={isPending && variables?.direction === "up"}
  downVoteDisabled={isPending && variables?.direction === "down"}
```

## 5. 影響範囲 / 既存への変更

- **client**: `VoteControl.tsx`, `PostCard.tsx`, `CommentCard.tsx`, `PostThreadScene.tsx`, `HomeFeedScene.tsx`, `CommunityScene.tsx`
- **テスト**: `VoteControl.test.tsx`, `PostCard.test.tsx`, `CommentCard.test.tsx`
- **server / common / docs**: 変更なし

## 6. テスト計画（TDDで書くテスト一覧）

### VoteControl.test.tsx
- `upDisabled=true` のとき up ボタンのみ disabled、down は enabled
- `downDisabled=true` のとき down ボタンのみ disabled、up は enabled
- 両方未指定のとき両ボタン enabled
- 既存テスト: `disabled=true` → `upDisabled=true, downDisabled=true` に更新

### PostCard.test.tsx
- `upVoteDisabled=true` のとき up ボタンのみ disabled
- `downVoteDisabled=true` のとき down ボタンのみ disabled
- 既存の `voteDisabled` テストを `upVoteDisabled`/`downVoteDisabled` 両方 true に更新

### CommentCard.test.tsx
- PostCard と同様の方向別テストを追加

## 7. リスク・未決事項

- なし。`variables` は TanStack Query v5 で型付きのため、型チェックが通ることを確認する。
