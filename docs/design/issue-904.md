# 設計書: e2e/community UC-COMM-17〜18 Playwright テスト実装 (#904)

## 1. 目的 / 背景

`e2e/community/usecases.md` に UC-COMM-17（コメント Chip クリック → `/posts/$postId#comments` 遷移）と UC-COMM-18（投稿一覧がフラットリスト表示）が定義されているが、`community.spec.ts` に対応する `test.todo()` エントリが一切存在しない。CLAUDE.md の規定（usecases.md の見出しと spec.ts の `test.todo()` が 1:1 対応する）に違反している状態。

## 2. スコープ（やること / やらないこと）

**やること**:
- `e2e/community/community.spec.ts` に UC-COMM-17・UC-COMM-18 の Playwright テストを実装する
- usecases.md との整合を確認する

**やらないこと**:
- クライアント実装の変更（#836・#834 は実装済み）
- UC-COMM-16 の実装（別 Issue #899）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `e2e/community/community.spec.ts` に UC-COMM-17・UC-COMM-18 の `test()` 実装を追加する
2. UC-COMM-17: コミュニティフィードの投稿カードのコメント Chip をクリックすると `/posts/$postId#comments` へ遷移することを確認
3. UC-COMM-18: コミュニティ詳細の投稿一覧が `border-bottom` のフラットリストで表示される（`borderBottom: "1px solid"` スタイル）ことを確認
4. `e2e/community/usecases.md` の UC-COMM-17・18 定義と整合している
5. e2e テストがローカルで pass する

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### UC-COMM-17 の検証方針

`CommunityScene.tsx` の実装:
- `post.comment_count` が非 0 のとき、`PostCard` の `onCommentClick` に `navigate({ to: "/posts/$postId", params: { postId: post.id }, hash: "comments" })` を渡す
- `PostCard` の comment Chip は `onCommentClick` が渡されたとき `onClick` で呼び出す

テスト: `page.waitForURL("**/posts/post-1#comments")` で遷移先 URL を確認。
コメント Chip は `aria-label="コメント N 件"` で特定可能。

### UC-COMM-18 の検証方針

`PostCard` の `variant="list"` で `listBoxSx = { borderBottom: "1px solid", borderColor: "divider", p: 2 }` が適用される。

テスト: 投稿 Box の `border-bottom` スタイル（`1px solid`）を `evaluate()` で検証。

## 5. 影響範囲 / 既存への変更

- **`e2e/community/community.spec.ts`**: UC-COMM-17・18 のテストを追加

## 6. テスト計画（TDD で書くテスト一覧）

1. UC-COMM-17: コミュニティフィードのコメント Chip をクリックすると `/posts/$postId#comments` へ遷移する
2. UC-COMM-18: コミュニティ詳細の投稿一覧がフラットリスト（border-bottom 区切り）で表示される

## 7. リスク・未決事項

- TanStack Router のハッシュナビゲーションが `page.waitForURL` で検出できるか（`#comments` は history ではなく scroll のみの可能性）→ URL 変化を `waitForURL` で確認し、変化しない場合は `page.url()` のアサーションで代替
