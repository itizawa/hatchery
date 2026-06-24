# 設計書: ポスト一覧画面（ホームフィード / コミュニティ画面）でも PostCard に ShareButton を表示する (#838)

## 1. 目的 / 背景

`PostCard` には `postUrl` prop を渡すと ShareButton（URL コピー・X シェア）を表示する実装が既に存在する。
`PostThreadScene`（スレッド詳細）では渡しているが、`HomeFeedScene`・`CommunityScene` のフィード一覧では渡していないため ShareButton が表示されない。
各投稿カードから直接ポストを共有できるようにする。

## 2. スコープ（やること / やらないこと）

### やること
- `HomeFeedScene.tsx` の `PostCard` に `postUrl` を渡す
- `CommunityScene.tsx` の `PostCard` に `postUrl` を渡す
- `PostCard.tsx` で `voteStopPropagation=true` 時に ShareButton クリックが RouterLink へ伝播しないようにする

### やらないこと
- コメント共有（#775 対応済み）
- コミュニティ自体の共有（#257 対応済み）
- `ShareButton` コンポーネント自体の変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `HomeFeedScene` のフィードに投稿がある場合、各 `PostCard` に共有ボタン（「共有」ラベル）が表示される
2. `CommunityScene` のフィードに投稿がある場合、各 `PostCard` に共有ボタンが表示される
3. `PostCard` で `voteStopPropagation=true` かつ `postUrl` あり → 共有ボタンクリック時に `stopPropagation` と `preventDefault` が呼ばれる（RouterLink への伝播が止まる）
4. `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### `postUrl` の生成パターン
`PostThreadScene` と同じ `` `${window.location.origin}/posts/${post.id}` `` を使う。

### stopPropagation パターン
`PostCard.tsx` の `handleVoteClick`（`voteStopPropagation` が true のとき `e.stopPropagation()` + `e.preventDefault()` を呼ぶ関数）を ShareButton のラッパー `Box` の `onClick` にも適用する。これは VoteControl と同じパターンで一貫性がある。

```tsx
{postUrl && (
  <Box onClick={handleVoteClick}>
    <ShareButton shareUrl={postUrl} shareTitle={post.title} />
  </Box>
)}
```

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client）

- `client/src/components/PostCard.tsx` — ShareButton ラッパー修正（stopPropagation 対応）
- `client/src/routes/HomeFeedScene.tsx` — `PostCard` に `postUrl` 追加
- `client/src/routes/CommunityScene.tsx` — `PostCard` に `postUrl` 追加

バックエンド・API 変更なし。OpenAPI 変更なし。

## 6. テスト計画（TDD で書くテスト一覧）

### PostCard.test.tsx
- `voteStopPropagation=true` + `postUrl` あり → 共有ボタンクリックで stopPropagation と preventDefault が呼ばれる

### HomeFeedScene.test.tsx
- フィードの PostCard に共有ボタンが表示される

### CommunityScene.test.tsx
- コミュニティフィードの PostCard に共有ボタンが表示される

## 7. リスク・未決事項

なし。実装は小さく既存 prop と同じパターンを踏襲するだけ。
