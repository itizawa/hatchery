# 設計書: e2e/home-feed の UC-HOME-20〜23 を Playwright テストとして実装する (#896)

## 1. 目的 / 背景

`e2e/home-feed/home-feed.spec.ts` の UC-HOME-20〜23 は `test.todo()` のままで vote UX（連打防止・塗りつぶし・ネットスコア・リロード復元）が e2e で検証されていない。対応する機能（#748, #813, #856, #831）は CLOSED（実装済み）だが、リリース判定（`/release-check`）がこれらの振る舞いを自動検証できない状態が続いている。

## 2. スコープ（やること / やらないこと）

**やること**:
- UC-HOME-20: vote mutation 進行中に up/down vote ボタンが disabled になることを Playwright で検証
- UC-HOME-21: vote 後に VoteControl Box の `data-voted` 属性が voted 方向に変わることを検証
- UC-HOME-22: VoteControl が表示する数字が `post.score`（up − down のネットスコア）であることを検証
- UC-HOME-23: ページリロード後も feed が `my_vote` を返すことで vote 状態が復元されることを検証

**やらないこと**:
- UC-HOME-24〜25（別 Issue）
- 実 API / 実 DB への接続（全テストで `page.route` による API モック使用）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. UC-HOME-20: up vote ボタンをクリック後（API 応答前）に、当該ボタンが `disabled` 属性を持つ。API 応答後はボタンが再度有効化される。
2. UC-HOME-21: up vote 後に VoteControl の `[data-voted]` 属性が `"up"` になる（楽観更新で即座に変わる）。
3. UC-HOME-22: `score: 8` の投稿の VoteControl 内に `"8"` が表示される。
4. UC-HOME-23: vote 後にページをリロードすると、feed モックが `my_vote: "up"` を返し、VoteControl の `[data-voted]` が `"up"` で復元される。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### モックデータ形式

既存の `setupCommonMocks` は旧フォーマット（`items` / `upVoteCount` 等）を使っているが、実際の API は `PostSchema`（`score`, `my_vote`, `comment_count`）と feed レスポンス `{ posts: Post[], nextCursor: string | null }` を使う。新テストは正しいフォーマットを使う。

```typescript
const MOCK_POST_VOTE = {
  id: "vote-test-post",
  community_id: "comm1",
  slot_key: "2025-01-01T10:00",
  seq: 0,
  author: "Alice",
  title: "TypeScript の型推論はすごい",
  text: "TypeScript の型推論は非常に優秀です。",
  score: 8,  // UC-HOME-22 で "8" が表示されることを検証
  created_at: "2025-01-01T07:00:00.000Z",
  comment_count: 2,
  my_vote: null,
  author_worker: null,
};
```

### vote API ルート

- 正: `**/api/posts/*/vote`（singular）← `votes.ts` の `openApiClient.POST("/api/posts/{postId}/vote", ...)`
- `page.route` の `*` は単一パスセグメントに合致するので postId を問わずインターセプト可能

### VoteControl の DOM 属性

- `[data-voted]`: `"up"` / `"down"` / `"none"`（VoteControl の外枠 Box に付与）
- ボタン: `aria-label="up vote"` / `aria-label="down vote"`

### UC-HOME-20 の遅延パターン

```typescript
let resolveVote!: () => void;
await page.route("**/api/posts/*/vote", async (route) => {
  await new Promise<void>((resolve) => { resolveVote = resolve; });
  await route.fulfill({ ... });
});
// click → isVotingPost = true → button disabled → resolveVote() → re-enabled
```

### UC-HOME-23 のリロード後復元

`page.route` ハンドラはリロード後も有効。`let postMyVote: "up" | "down" | null = null` をクロージャで持ち、vote API が呼ばれたら `postMyVote = "up"` に更新する。feed ルートハンドラは毎回 `postMyVote` の現在値を読んでレスポンスを返すため、リロード後の feed リクエストで `my_vote: "up"` が返る。

## 5. 影響範囲 / 既存への変更

- **変更対象**: `e2e/home-feed/home-feed.spec.ts`（test.todo を実テストに置換）
- **他への影響**: なし（テストファイルのみ変更）

## 6. テスト計画

| テスト | 検証内容 |
|--------|----------|
| UC-HOME-20 | ミューテーション進行中に up vote ボタンが disabled, 完了後に enabled |
| UC-HOME-21 | up vote 後に `[data-voted]` が `"up"` |
| UC-HOME-22 | `score: 8` のとき VoteControl 内に `"8"` が表示される |
| UC-HOME-23 | vote → リロード → `[data-voted]` が `"up"` で復元 |

## 7. リスク・未決事項

- 既存の `setupCommonMocks` は旧フォーマットを使っており、既存テスト（UC-HOME-01〜19）は現在のコンポーネントと整合していない可能性がある。新テスト（UC-HOME-20〜23）は独立したモック関数 `setupVoteTestMocks` を使うことで影響を避ける。
- e2e テストは CI に組み込まれていないため（playwright.config.ts のコメント参照）、ローカル実行（`pnpm e2e`）で動作確認する。
