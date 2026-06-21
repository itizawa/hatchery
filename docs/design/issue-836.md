# 設計書: ポスト一覧画面のコメント Chip クリック → ポスト詳細コメント遷移 (#836)

## 1. 目的 / 背景

ポスト一覧（HomeFeedScene・CommunityScene）の PostCard にあるコメント数 Chip をクリックすると、ポスト詳細画面（PostThreadScene）のコメントセクションへ直接スクロール遷移できるようにする。PostCard にはすでに `onCommentClick` prop が定義済みだが、一覧画面では渡されていない。

## 2. スコープ（やること / やらないこと）

**やること:**
- HomeFeedScene で PostCard に `onCommentClick` を渡す（`navigate({ to: "/posts/$postId", params, hash: "comments" })`）
- CommunityScene でも同様に `onCommentClick` を渡す
- PostThreadScene のコメントセクション Box に `id="comments"` を付与し、ハッシュ遷移でブラウザのアンカースクロールが動作するようにする
- PostCard の Chip onClick で `e.preventDefault()` + `e.stopPropagation()` を呼び RouterLink への伝播を防ぐ

**やらないこと:**
- URL hash の保持・ブックマーク対応
- server / common / docs への変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. HomeFeedScene で PostCard に `onCommentClick` が渡され、コメント数 Chip がクリック可能になる
2. CommunityScene でも同様に `onCommentClick` が渡される
3. コメント Chip クリック時に `navigate({ to: "/posts/$postId", params: { postId }, hash: "comments" })` でハッシュ付きナビゲートされる
4. PostThreadScene のコメントセクション Box に `id="comments"` が付与されている
5. コメント Chip クリックで `e.preventDefault()` + `e.stopPropagation()` が呼ばれ、RouterLink への二重遷移が起きない
6. 既存のカード全体クリック（RouterLink）遷移は引き続き動作する

## 4. 設計方針

- **PostCard の Chip onClick**: `onCommentClick` が渡されている場合のみ、`e.preventDefault()` + `e.stopPropagation()` を実行してから `onCommentClick()` を呼ぶラッパーに変更する。`voteStopPropagation` と同じパターン。
- **HomeFeedScene / CommunityScene**: `navigate` フックを使い `hash: "comments"` 付きで遷移するコールバックを `onCommentClick` に渡す。CommunityScene は既存の `useParams` に加えて `useNavigate` を追加する。
- **PostThreadScene**: `<Box ref={commentSectionRef} sx={{ mt: 2 }}>` に `id="comments"` を追加するのみ。既存の `scrollToComments()` 関数は PostThreadScene 内の Chip クリック用に引き続き使用。

## 5. 影響範囲 / 既存への変更

- `client/src/components/PostCard.tsx` — Chip onClick ラッパー追加
- `client/src/routes/HomeFeedScene.tsx` — `onCommentClick` prop 追加
- `client/src/routes/CommunityScene.tsx` — `useNavigate` import 追加 + `onCommentClick` prop 追加
- `client/src/routes/PostThreadScene.tsx` — コメントセクション Box に `id="comments"` 追加

## 6. テスト計画（TDD で書くテスト一覧）

### PostCard.test.tsx
- `onCommentClick` 指定時にコメント Chip クリックでコールバックが呼ばれる
- `onCommentClick` 指定時にコメント Chip クリックで `stopPropagation` と `preventDefault` が呼ばれる
- `onCommentClick` 未指定時はクリックイベントが起きない（clickable=false）

### HomeFeedScene.test.tsx
- コメント Chip をクリックすると `/posts/$postId#comments` へ遷移する

### PostThreadScene.test.tsx
- コメントセクション要素に `id="comments"` が付与されている

## 7. リスク・未決事項

- MUI Chip の `onClick` は `clickable=false` のときも呼ばれる可能性があるが、既存実装で `clickable={!!onCommentClick}` となっており問題なし。
