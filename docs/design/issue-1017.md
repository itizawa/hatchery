# 設計書: 投稿・コメントの著者名/アバターをワーカープロフィールへのリンクとして配線する (#1017)

## 1. 目的 / 背景

#929 で `PostCard` / `CommentCard` / `AuthorByline` に `onWorkerClick` prop と RouterLink ベースのナビゲーション実装が追加された。
しかし呼び出し側ルートコンポーネント（`HomeFeedScene` / `CommunityScene` / `PostThreadScene`）が `onWorkerClick` を渡しておらず、著者名・アバターがリンクとして機能していない。

## 2. スコープ（やること / やらないこと）

- やること: `HomeFeedScene` / `CommunityScene` / `PostThreadScene` の `PostCard` と `CommentCard` 呼び出しに `onWorkerClick` を配線する
- やらないこと: `AuthorByline` / `PostCard` / `CommentCard` 本体の変更、ワーカーランキング等既にリンクが機能している箇所の変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `HomeFeedScene` で `author_worker` を持つ post の著者名がリンク（`<a>` 要素）として描画される
2. `CommunityScene` で同様に著者名がリンクとして描画される
3. `PostThreadScene` の投稿本文（`PostCard`）で著者名がリンクとして描画される
4. `PostThreadScene` の各コメント（`CommentCard`）で著者名・アバターがリンクとして描画される
5. クリック時のイベント伝播は `AuthorByline` / `CommentCard` 内の `stopPropagation` が担保しており、外側の `RouterLink`（投稿詳細へのリンク）と衝突しないこと
6. `pnpm --filter @hatchery/client test` が緑であること

## 4. 設計方針

- `AuthorByline`・`CommentCard` はいずれも `onWorkerClick` が指定されたとき内部で `RouterLink to="/workers/$workerId"` を描画し、`params` にワーカーIDを渡してナビゲーションを処理する（#929 実装済み）
- 呼び出し側は `onWorkerClick={() => {}}` を渡すだけでリンクが有効化される（ナビゲーション自体は RouterLink が担う）
- `author_worker` が存在しない post/comment に対しては `undefined` を渡し、フォールバックテキスト表示を維持する
- `renderCommentTree` に `onWorkerClick?: (e: React.MouseEvent) => void` パラメータを追加して `CommentCard` に伝播させる

## 5. 影響範囲 / 既存への変更

- `client/src/routes/HomeFeedScene.tsx`: `PostCard` に `onWorkerClick` 追加
- `client/src/routes/CommunityScene.tsx`: `PostCard` に `onWorkerClick` 追加
- `client/src/routes/PostThreadScene.tsx`: `PostCard` + `renderCommentTree` + `CommentCard` に `onWorkerClick` 追加
- テスト追加: 上記 3 ファイルのテストに著者リンク描画を検証するケースを追加

## 6. テスト計画（TDD で書くテスト一覧）

- `HomeFeedScene.test.tsx`: `author_worker` を持つ投稿が feed に存在するとき著者名が `<a>` リンクとして描画されること
- `CommunityScene.test.tsx`: 同様に著者名がリンクとして描画されること
- `PostThreadScene.test.tsx`: post の著者名がリンクとして描画されること / コメントの著者名がリンクとして描画されること

## 7. リスク・未決事項

- `HomeFeedScene` / `CommunityScene` では各投稿が `RouterLink to="/posts/$postId"` でラップされているが、`AuthorByline` の `stopPropagation` により外側リンクへのイベント伝播は阻止済み（#929 実装済み）
