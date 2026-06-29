# 設計書: e2e/home-feed の UC-HOME-24〜25 を Playwright テストとして実装する (#903)

## 1. 目的 / 背景

`e2e/home-feed/usecases.md` に UC-HOME-24（コメント Chip クリック / #836）・UC-HOME-25（フラットリスト表示 / #834）が未定義かつ `home-feed.spec.ts` にもスケルトンが存在しない。CLAUDE.md の「usecases.md の `## UC-XXX-NN` と spec.ts の `test.todo()` は 1:1 対応」規約に違反しており、この 2 ユースケースがリグレッション検知の対象外になっている。

## 2. スコープ（やること / やらないこと）

**やること**:
- `e2e/home-feed/usecases.md` に UC-HOME-24・UC-HOME-25 を追加（UC-HOME-23 と UC-HOME-26 の間）
- `e2e/home-feed/home-feed.spec.ts` に UC-HOME-24・UC-HOME-25 の Playwright テストを実装

**やらないこと**:
- クライアント実装の変更（#836・#834 は既に CLOSED）
- UC-HOME-24・UC-HOME-25 以外のユースケースの変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `home-feed.spec.ts` に UC-HOME-24・UC-HOME-25 の実装が追加されている（`test.todo` ではない）
2. UC-HOME-24: フィードの投稿カードでコメント Chip をクリックすると URL が `/posts/$postId#comments` に遷移する
   - `comment_count > 0` の投稿のコメント Chip（`aria-label="コメント N 件"`）をクリック
   - `expect(page).toHaveURL(...)` で遷移先 URL を確認
3. UC-HOME-25: ホームフィードの投稿一覧が `data-variant="list"` のフラットリスト表示である
   - `[data-variant="list"]` locator が可視状態
   - `[data-variant="card"]` locator が存在しない
4. `e2e/home-feed/usecases.md` に UC-HOME-24・UC-HOME-25 の定義が追加されている
5. 既存テストの変更なし・既存テストが引き続き pass する

## 4. 設計方針

### UC-HOME-24 テスト設計

- 既存の `setupVoteTestMocks` を流用（`MOCK_POST_VOTE.comment_count = 2` で onCommentClick が有効化される）
- コメント Chip は `aria-label="コメント N 件"` を持つ `role="button"` の div
- クリック後 `expect(page).toHaveURL(new RegExp(...))` で URL 確認
- モック方針: 既存 `setupVoteTestMocks` で十分（post thread への API モックは追加しない。URL 確認のみで OK）

### UC-HOME-25 テスト設計

- `PostCard` コンポーネントは `variant="list"` のとき `data-variant="list"` 属性を持つ
- `HomeFeedScene` は全 PostCard を `variant="list"` で描画する（#834 実装済み）
- `page.locator('[data-variant="list"]')` で確認

## 5. 影響範囲 / 既存への変更

- `e2e/home-feed/usecases.md`: UC-HOME-24・UC-HOME-25 エントリを追加
- `e2e/home-feed/home-feed.spec.ts`: UC-HOME-24・UC-HOME-25 テストを追加

クライアント・サーバ・common に変更なし。ユーザー可視の振る舞い変更なし（純粋なテスト追加）。

## 6. テスト計画（TDD で書くテスト一覧）

| テスト | locator / assertion |
|--------|---------------------|
| UC-HOME-24: コメント Chip クリックで `#comments` へ遷移 | `getByRole("button", { name: /コメント 2 件/ })`.click() → URL に `/posts/vote-test-post#comments` |
| UC-HOME-25: フラットリスト表示の確認 | `locator('[data-variant="list"]').first()` が visible、`[data-variant="card"]` が not visible |

## 7. リスク・未決事項

- UC-HOME-24: クリック後にポストスレッド API が 404 になるが URL 確認には影響しない
- なし
