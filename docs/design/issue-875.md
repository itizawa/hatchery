# 設計書: ポスト一覧のコメント数が未来（未公開）のコメントを含めて集計されている (#875)

## 1. 目的 / 背景

ホームフィード / コミュニティのポスト一覧に表示されるコメント数バッジが、reveal フィルタ（`createdAt <= now`）をくぐり抜けていない未来のコメントまで加算されている。スレッドを開いた実際の表示コメント数と一覧のバッジが食い違う。

## 2. スコープ（やること / やらないこと）

**やること:**
- `CommentRepository.countByPostIds` に `RevealFilterOptions`（`options?: { now?: Date }`）を追加
- インメモリ実装・Prisma 実装で `now` フィルタを適用
- `attachCommentCount` に `options?: RevealFilterOptions` を追加
- `communities.ts` / `feed.ts` の呼び出し側で `{ now }` を渡す

**やらないこと:**
- 投稿詳細スレッド側（`listByPost` は既に reveal 済み）
- コメント数順ソート等の新機能
- e2e ユースケースの新規追加（バッジの数値が正しくなるだけで UI 構造は不変）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `countByPostIds(postIds, { now })` を呼ぶと `createdAt > now` のコメントが件数に含まれない
2. `countByPostIds(postIds)` を引数省略で呼ぶと全件集計（後方互換）
3. `attachCommentCount(records, commentRepo, { now })` を呼ぶと `now` が `countByPostIds` へ透過的に渡される
4. コミュニティフィード（`communities.ts`）で post 取得と同じ `now` がコメント集計にも適用される
5. ホームフィード（`feed.ts`）で post 取得と同じ `now` がコメント集計にも適用される
6. `pnpm turbo run build test lint` がすべて緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- `countByPostIds` のシグネチャ拡張: 第 2 引数に `options?: RevealFilterOptions` を追加（eslint-disable-next-line max-params で許容）
- `attachCommentCount` のシグネチャ拡張: 第 3 引数に `options?: RevealFilterOptions` を追加し `countByPostIds` へ透過的に流す
- インメモリ実装の `countByPostIds`: `now` が渡された場合に `r.createdAt.getTime() <= now.getTime()` フィルタを追加
- Prisma 実装の `countByPostIds`: `groupBy` の `where` に `...(now !== undefined ? { createdAt: { lte: now } } : {})` を追加
- `communities.ts`: `attachCommentCount(posts, commentRepo)` → `attachCommentCount(posts, commentRepo, { now })` に変更
- `feed.ts`: `attachCommentCount(enriched, commentRepo)` → `attachCommentCount(enriched, commentRepo, { now })` に変更

## 5. 影響範囲 / 既存への変更

- `server/src/persistence/commentRepository.ts` — インターフェース + インメモリ実装
- `server/src/persistence/prismaCommentRepository.ts` — Prisma 実装
- `server/src/routes/commentCount.ts` — `attachCommentCount` シグネチャ
- `server/src/routes/communities.ts` — 呼び出し側
- `server/src/routes/feed.ts` — 呼び出し側
- テスト: `commentRepository.test.ts` / `commentCount.test.ts`

## 6. テスト計画（TDD で書くテスト一覧）

### `commentRepository.test.ts`（インメモリ）
- `countByPostIds` に `now` を渡すと `createdAt > now` のコメントが件数に含まれない
- `countByPostIds` に `now` を渡さないと全件集計（後方互換）
- 過去・未来混在の post で `now` フィルタが正確に適用される

### `commentCount.test.ts`
- `attachCommentCount` に `options` を渡すと `countByPostIds` へ透過的に渡される

## 7. リスク・未決事項

- `countByPostIds` の既存呼び出し箇所は `communities.ts` と `feed.ts` の 2 箇所のみ（全て変更対象）。他に呼び出し箇所がないことを確認済み。
- Prisma 実装のテストは DB 不要のインメモリで代替（統合テストは別 Issue）。
