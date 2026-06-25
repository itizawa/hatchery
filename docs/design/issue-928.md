# 設計書: ホームフィード・人気ページを 2 カラムレイアウトに変更し右サイドバーに横断新着ポストを表示する (#928)

## 1. 目的 / 背景

ホームフィード（`/`）と人気フィード（`/popular`）の `HomeFeedScene.tsx` はシングルカラム（`maxWidth: 800`）で実装されているが、コミュニティ詳細ページ（`CommunityScene.tsx`）は #370 で Reddit 風 2 カラムレイアウト（左: Post 一覧 / 右: コミュニティ詳細 sticky サイドバー）に変更済みである。

ホームや人気ページでもレイアウトを統一し、右サイドバーに全コミュニティを横断した新着ポストをコンパクトに表示することで、情報密度と回遊性を向上させる。

## 2. スコープ（やること / やらないこと）

### やること

- `HomeFeedScene.tsx` を 2 カラムレイアウトに変更（`maxWidth: 1200`、`CommunityScene` と同構成）
- 右サイドバー用コンポーネント `RecentPostsSidebarCard.tsx` を新規作成
- 右サイドバー用フック `useRecentPostsSidebar` を `client/src/api/feed.ts` に追記
- `e2e/home-feed/usecases.md` に右サイドバー関連の UC を追記

### やらないこと

- サイドバーでの投票機能（別 Issue）
- サイドバー内の人気コミュニティ一覧（別 Issue）
- モバイル（md 未満）での新着ポスト表示（非表示のまま）
- サイドバーの無限スクロール（最新 10 件固定）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `HomeFeedScene.tsx` の `maxWidth` が `800` から `1200` に変わり、2 カラム構成（`display: flex, gap: 3`）になる
2. 右カラムは `width: 312, flexShrink: 0, display: { xs: "none", md: "block" }, position: "sticky", top: 80` で実装され、md 未満の画面では非表示になる
3. `RecentPostsSidebarCard` コンポーネントが存在し、最新 10 件の投稿をコンパクトリスト（タイトル・本文冒頭・コミュニティ名・投稿時刻）で表示する
4. 各ポストエントリはクリックで `/posts/$postId` に遷移する
5. コミュニティ名クリックで `/communities/$slug` に遷移する
6. 投票ボタンは表示しない（読み取り専用）
7. `useRecentPostsSidebar` フックが `GET /api/feed?sort=latest&limit=10` を `useSuspenseQuery` で取得する
8. `/`（latest）と `/popular`（popular）の両方で右サイドバーが表示される
9. `e2e/home-feed/usecases.md` に UC-HOME-27 以降（右サイドバー関連）が追記されている
10. `pnpm turbo run build test lint` が緑

## 4. 設計方針

### コンポーネント構成

```
HomeFeedScene
├── Box (2-column flex container, maxWidth: 1200)
│   ├── Box (left column, flex: 1) — 既存のポスト一覧
│   └── Box (right column, sticky, display: {xs:none, md:block})
│       └── RecentPostsSidebarCard
```

### `RecentPostsSidebarCard`

- `CommunitySidebarCard` の `outerBoxSx` スタイル（`border: 1, borderColor: divider, borderRadius: 1, p: 2`）を踏襲
- `useSuspenseQuery` で取得した 10 件のポストをリスト表示
- `QueryBoundary` でローディング/エラーをラップ（サイドバー内の局所フォールバック）
- 各エントリ: タイトル（`variant="body2"` + `fontWeight: medium`）、本文冒頭（1-2 行省略）、コミュニティ名リンク、投稿時刻

### `useRecentPostsSidebar` フック

- `feed.ts` に追記
- `useSuspenseQuery` で `fetchHomeFeedPage({ sort: "latest", limit: 10 })` を呼ぶ
- queryKey: `["recent-posts-sidebar"]`（vote mutation の onMutate クラッシュを避けるため `"feed"` プレフィックスを使わない）

## 5. 影響範囲 / 既存への変更

- `client/src/routes/HomeFeedScene.tsx` — レイアウト変更（`maxWidth: 800 → 1200` / 2 カラム化）
- `client/src/api/feed.ts` — `useRecentPostsSidebar` フック追加
- `client/src/components/RecentPostsSidebarCard.tsx` — 新規作成
- `client/src/components/RecentPostsSidebarCard.test.tsx` — 新規作成（Vitest）
- `e2e/home-feed/usecases.md` — UC-HOME-27〜29 追記
- `e2e/usecases.md` — home-feed サマリ更新

## 6. テスト計画（TDD で書くテスト一覧）

### `RecentPostsSidebarCard.test.tsx`

1. 投稿リストを渡すと投稿タイトルが表示される
2. 各投稿エントリは `/posts/$postId` へのリンクを持つ
3. コミュニティ名は `/communities/$slug` へのリンクである
4. 投票ボタンが表示されない（読み取り専用）
5. 投稿が 0 件のとき空状態メッセージが表示される
6. 本文冒頭が表示される（`truncate` / `line-clamp` による省略）

## 7. リスク・未決事項

- `fetchHomeFeedPage` の `limit` パラメータが OpenAPI spec 側で型チェックされるか確認が必要（`number` 型として渡す）
- `communityById` のマッピングは既存の `usePublicCommunities` フックを活用する。`RecentPostsSidebarCard` 内でも同様に `community_id` → コミュニティ情報を解決する。
