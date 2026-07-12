# 設計書: ホームと人気ページを統合し、ホームに人気投稿のみを表示する (#1067)

## 1. 目的 / 背景

- ホーム（`/`）と人気（`/popular`）は同一コンポーネント `HomeFeedScene` を `sort` prop 違いで描画しているだけで、実質的に重複ページになっている。
- #928 で両ページに右サイドバー（新着投稿・`sort=latest` 固定）が追加された結果、ホーム（`/`, sort=latest）は「左メインリスト（新着）」と「右サイドバー（新着）」がほぼ同じ内容になり二重表示化している。
- ホームと人気ページを統合し、ホーム（`/`）を人気投稿専用ページにする。右サイドバー（新着）はそのまま残すことで「左＝人気順／右＝新着」の役割分担にする。

## 2. スコープ（やること / やらないこと）

**やること**

- `/popular` ルートを廃止し、`/` へリダイレクトする。
- `HomeFeedScene` から `sort` prop・`HomeFeedSceneProps`・見出し出し分け（`FEED_HEADING`）を削除し、メインリスト（左カラム）を常に `sort=popular` 固定にする。
- グローバルサイドバーナビ（`SidebarGlobalNav`）から「人気」項目を削除する。
- 右カラムの `RecentPostsSidebarPanel`（`sort=latest` 固定）は変更しない。
- 上記変更に追従して壊れる既存テスト（ユニット・e2e）とドキュメント（`e2e/usecases.md` 系）を更新する。

**やらないこと**

- サイドバー自体の並び順変更（新着以外への切り替え等）。
- ホームでの人気/新着切り替え UI（タブ等）の再導入。
- `common` / `server` の変更（`sort=popular` は `GET /api/feed` に既存で対応済み。ADR-0006 の OpenAPI 一方向フローに変更なし）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `/popular` へアクセスすると `/` へリダイレクトされる。
2. `/` を開くと `GET /api/feed?...sort=popular...` が呼ばれ、メインリスト（左カラム）は vote スコア降順で表示される。
3. `/` の見出しが固定文言（「人気の投稿」）になり、`sort` prop による出し分けが存在しない。
4. 右カラムの新着投稿サイドバー（`sort=latest` 固定）は従来どおり表示・遷移できる。
5. グローバルナビ（デスクトップ恒久サイドバー・モバイルドロワー双方）に「人気」リンクが存在しない。「ホーム」「ランキング」等の他項目は維持される。
6. 上記変更に伴い破綻する既存ユニットテスト（`HomeFeedScene.test.tsx` / `RootLayout.test.tsx` / `router.test.tsx` / `AppHeader.test.tsx` / `AppRoot.test.tsx`）・e2e テスト（`e2e/community/community.spec.ts` の nav 項目検証）が更新され、全テスト緑になる。

## 4. 設計方針

- **ルーティング（`client/src/router.tsx`）**: `popularRoute` の `component` を削除し、`beforeLoad: () => { throw redirect({ to: "/" }); }` のみを持つリダイレクト専用ルートにする（既存の `requireAuth` / `requireAdminRoute` と同じ `throw redirect(...)` パターンを踏襲）。`indexRoute` は変更なし（`<LazyHomeFeedScene />` のまま、props なし）。
- **`HomeFeedScene`（`client/src/routes/HomeFeedScene.tsx`）**: `HomeFeedSceneProps` インターフェースと `sort` 引数、`FEED_HEADING` マップを削除。`useInfiniteHomeFeed(sort)` の呼び出しを `useInfiniteHomeFeed("popular")` に固定し、見出しは固定文字列 `"人気の投稿"` にする（`sort=popular` 時に既存表示されていた文言をそのまま採用し、実際の並び順と一致させる）。
- **`RootLayout`（`client/src/routes/RootLayout.tsx`）**: `SidebarGlobalNav` から「人気」の `ListItem`（`to="/popular"`）を削除。未使用になる `TrendingUpIcon` import と `isPopularActive` 変数も削除する。「ホーム」「ランキング」は変更しない。
- **後方互換**: `/popular` への既存ブックマーク・外部リンクは `beforeLoad` のリダイレクトでそのまま `/` に着地させ、404 にしない。

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: **client** のみ（`common` / `server` の変更なし。`GET /api/feed?sort=popular` は既存 API のまま利用）。
- 変更ファイル: `client/src/router.tsx`、`client/src/routes/HomeFeedScene.tsx`、`client/src/routes/RootLayout.tsx`。
- 追従更新: `client/src/routes/HomeFeedScene.test.tsx`、`client/src/routes/RootLayout.test.tsx`、`client/src/router.test.tsx`、`client/src/components/AppHeader.test.tsx`、`client/src/AppRoot.test.tsx`、`e2e/community/community.spec.ts`、`e2e/home-feed/usecases.md`、`e2e/community/usecases.md`、`e2e/home-feed/home-feed.spec.ts`（UC-HOME-01 のタイトル文言）。
- `HomeFeedScene.stories.tsx` は既に存在しない（Storybook は撤去済み、CLAUDE.md `docs/` 節参照）ため対象外。

## 6. テスト計画（TDD で書くテスト一覧）

- `HomeFeedScene.test.tsx`: `/` の見出しが「人気の投稿」になること、GET /api/feed に `sort=popular` が含まれること（既存の `/popular` 用テストを `/` 用に置き換え）。他の遷移系テストの見出し非表示アサーションを新見出しに更新。
- `RootLayout.test.tsx` / `router.test.tsx` / `AppHeader.test.tsx` / `AppRoot.test.tsx`: 見出し文言更新、「人気」ナビ項目の存在検証テストを削除。
- `router.test.tsx`: `/popular` → `/` へリダイレクトされることを検証する新規テストを追加。
- `e2e/community/community.spec.ts`: モバイルドロワーの全ナビ項目表示テストから「人気」アサーションを削除。

## 7. リスク・未決事項

- 見出し文言は「人気の投稿」を採用（既存 `/popular` 表示文言をそのまま踏襲し、実装差分を最小化）。表現の適否はプロダクトオーナーの今後のフィードバックで調整余地あり。
- `/popular` を指す外部リンク・ブックマークは `/` へリダイレクトされるため、`sort=popular` を明示した URL としての意味は失われるが、内容は同一（人気順）になるため実害はない。
