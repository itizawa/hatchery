# 設計書: サイドバーに Reddit 風ナビゲーションメニュー（ホーム・人気・コミュニティを作る）を追加する (#435)

## 1. 目的 / 背景

現状のサイドバー（`RootLayout.tsx` の `SidebarContent` + `SidebarCommunitySection.tsx`）は「コミュニティ一覧 + 探す + （admin のみ）管理画面」のみで、ホームへ戻る導線・フィード切り替え導線が無い。Reddit のサイドバー風に、最上部へグローバルナビゲーション「ホーム / 人気 /（admin のみ）コミュニティを作る」を追加し、あわせて人気順（vote 数降順）フィードページ `/popular` を新設してフィードの回遊性を高める。

concept.md / ADR-0023 の制約（ユーザーの関与は up vote と community 購読のみ）により、一般ユーザーのコミュニティ作成機能は持たない。「コミュニティを作る」は admin にのみ表示し、既存の admin 作成 UI（`/admin?tab=communities`）へ誘導する。

## 2. スコープ（やること / やらないこと）

### やること
- サイドバー最上部に Reddit 風ナビゲーションメニュー（ホーム / 人気 / コミュニティを作る[admin 限定]）を追加（デスクトップ恒久サイドバー・モバイルドロワー共用）。
- アクティブルートのハイライト（角丸・グレー背景）。
- 人気順フィード: `HomeFeedQuerySchema` に `sort` 追加、`GET /api/feed?sort=popular`、`PostRepository.listPopularPaged`、`/popular` ルート、`HomeFeedScene` のパラメータ化。

### やらないこと
- 一般ユーザーのコミュニティ作成機能（ADR-0023 違反のため持たない）。
- hot ランキング等のスコア減衰アルゴリズム（vote 数=score 降順の単純ソートで十分）。
- 画像内「ニュース」「探索する」項目（「探す」は既存コミュニティセクションに残す）。

## 3. 受け入れ条件（テストに落とせる粒度）

### サイドバーナビゲーション（client / `RootLayout.tsx`）
- AC1: `SidebarContent` 最上部（コミュニティセクションより上）にナビゲーションメニュー（ホーム / 人気 /（admin のみ）コミュニティを作る）を表示する。
- AC2: 各項目はアイコン + ラベル（`HomeIcon` / `TrendingUpIcon` / `AddIcon`）。
- AC3: 「ホーム」は `/`、「人気」は `/popular`、「コミュニティを作る」は `/admin?tab=communities` へのリンク。
- AC4: 現在ルートに一致する項目をグレー背景（`action.selected` 相当）でハイライト（`/`→ホーム、`/popular`→人気がアクティブ）。
- AC5: 各項目は角丸（`borderRadius`）スタイル。
- AC6: 「コミュニティを作る」は `isAdmin(user)` のみ表示。非 admin・未ログインでは非表示。
- AC7: モバイルドロワーでも同メニューが表示される（`SidebarContent` 共用）。

### 人気順フィード（common / server / client）
- AC8: `HomeFeedQuerySchema` に `sort: z.enum(["latest","popular"]).default("latest")` を追加。
- AC9: `GET /api/feed?sort=popular` が score 降順（同点は createdAt 降順 → id 降順）でカーソルページネーション。`sort` 省略・`latest` は従来どおり新着順（後方互換）。
- AC10: OpenAPI 一方向フローで `sort` を型に反映。client は生成型経由で渡す。
- AC11: `/popular` ルート新設、人気順フィードを表示（`HomeFeedScene` をパラメータ化）。

### 品質
- AC12: 上記をテストで担保（client RTL / server route・repository / common schema）。TDD。
- AC13: `pnpm turbo run build test lint` が緑。一方向 import 境界を守る。

## 4. 設計方針

### common
- `HomeFeedSortSchema = z.enum(["latest", "popular"])` を追加し、`HomeFeedQuerySchema` に `sort: HomeFeedSortSchema.default("latest")` を加える。enum のため `.max()` 不要。

### server
- `PostRepository` に `listPopularPaged(cursor?, limit?)` を追加。
  - 並び順: `score desc, createdAt desc, id desc`。
  - カーソルは score を含む必要があるため `encodePopularCursor` / `decodePopularCursor`（payload `{ score, createdAt, id }`）を新設。既存の `listLatestPaged` 用 `encodeCursor`/`decodeCursor` はそのまま。
  - In-memory・Prisma 両実装。Prisma の where は keyset 条件 `(score < c.score) OR (score = c.score AND createdAt < c.createdAt) OR (score = c.score AND createdAt = c.createdAt AND id < c.id)`。
- `feed.ts` ルート: `sort` を読み、`popular` のとき `listPopularPaged`、それ以外 `listLatestPaged` を呼ぶ。`INVALID_CURSOR` ハンドリングは共通。
- `registry.ts`: `/api/feed` の query に `sort` を追加。

### client
- `homeFeedQueryKey(sort)` を `["feed", sort]` 形式に拡張。
- `fetchHomeFeedPage(cursor, sort)` / `useInfiniteHomeFeed(sort)` を sort 対応に。`sort==="latest"` のときは query から省略して後方互換（既存テストの URL 期待を壊さない）。
- `HomeFeedScene` を `sort` prop（既定 `"latest"`）でパラメータ化。タイトルは latest=「ホームフィード」/ popular=「人気の投稿」。
- `router.tsx` に `/popular` ルート（`HomeFeedScene sort="popular"`）を追加。
- `RootLayout.tsx` の `SidebarContent` 最上部にナビメニューを追加。`useLocation().pathname` でアクティブ判定。角丸 + `action.selected` ハイライト。

## 5. 影響範囲 / 既存への変更
- `common/src/domain/feed/feed.ts`（+ test）
- `server/src/persistence/postRepository.ts`（+ test）/ `prismaPostRepository.ts`（+ test 任意）/ `routes/feed.ts`（+ test）/ `openapi/registry.ts`
- `client/src/api/communities.ts` / `routes/HomeFeedScene.tsx`（+ test）/ `routes/RootLayout.tsx`（+ test）/ `router.tsx`

## 6. テスト計画（TDD）
- common: `sort` 省略時 `latest`・`popular` 受理・不正値拒否。
- server repository: `listPopularPaged` が score 降順、同点 createdAt 降順、カーソルで重複/欠落なし、不正カーソルで reject。
- server route: `GET /api/feed?sort=popular` が score 降順、`sort` 省略・`latest` で新着順、不正 sort で 400。
- client communities: `fetchHomeFeedPage(cursor, "popular")` が `sort=popular` を送る。`latest` では送らない。
- client HomeFeedScene: `/popular` で人気タイトル表示・posts 描画。
- client RootLayout: ホーム/人気リンクの href、アクティブハイライト、admin のみ「コミュニティを作る」表示、モバイルドロワーでも表示。

## 7. リスク・未決事項
- カーソル形式変更なし（popular 用は別エンコード関数で分離）。既存 latest カーソルへの影響なし。
- `score` を「vote 数」とみなす（既存の vote で `addScore` 加算される net score）。Issue の「vote 数降順」を score 降順で実現。
