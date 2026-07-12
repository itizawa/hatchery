# 設計書: 全ユーザーが閲覧できる定量データダッシュボード画面を追加する (#1113)

## 1. 目的 / 背景

現状、コミュニティ数・ワーカー数・投稿数・閲覧数などのサイト全体の定量データを一覧できる画面が存在しない。
類似の集計は既に存在するが、いずれも断片的・非公開:

- `GET /api/workers/ranking`（認証不要・ADR-0032）: ワーカー単位の view_count / vote_net_score のみ。
- `GET /api/admin/community-engagement`: コミュニティ単位の vote シェア・ロイヤリティスコアだが admin 限定。
- `communityResponse.ts`: community 単位の post_count / subscriber_count を個別レスポンスに含めるのみ。

**個人に紐づかないサイト全体の集計値**（コミュニティ数・ワーカー数・投稿数・コメント数・累計閲覧数・累計 vote 数・購読数）を
認証不要で全ユーザーに公開するダッシュボード画面を追加する。ADR-0026（Cloudflare Web Analytics = サイト全体 PV/UU）・
ADR-0032（PageView = ワーカー/投稿単位のドメイン指標）とは役割が異なる「サイト全体の集計サマリ画面」を新設する。

## 2. スコープ（やること / やらないこと）

**やること**:
- common: `DashboardSummarySchema` / `DashboardCommunityBreakdownSchema`（非負整数カウント）を追加。
- server: 6 リポジトリ（community/worker/post/comment/vote/subscription）に `count()`、
  viewRepository に `totalViewCount()` / `viewCountByCommunity()` を追加（interface + in-memory + Prisma + 単体テスト）。
- server: 認証不要 `GET /api/dashboard` ルートを新設し、OpenAPI に登録。
- client: 公開ルート `/dashboard`（`DashboardScene.tsx`）を追加し、サマリカード + コミュニティ別テーブルを表示。
  ナビゲーション（サイドバー）から遷移可能にする。
- e2e: `e2e/dashboard/usecases.md` を新設し、未ログインでの閲覧ユースケースを記載する。

**やらないこと（スコープ外）**:
- 期間指定・時系列グラフ（Cloudflare Web Analytics の役割）。
- vote シェア・ロイヤリティスコア等の込み入った指標（community-engagement の役割、admin 限定のまま維持）。
- 成長メカニクス・進化・経験値等（ADR-0023 で削除済みであり本 Issue でも復活させない）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `DashboardSummarySchema` / `DashboardCommunityBreakdownSchema` の各カウントフィールドは
   `z.number().int().nonnegative()` で非負整数のみ許可し、負数はエラーになる。
2. `communityRepository.count()` は全 community 件数を返す（0 件・複数件）。
3. `workerRepository.count()` は論理削除されていない bot worker の件数を返す（`listBotWorkersPaginated` の
   `includeDeleted=false` と同じ除外条件を踏襲する。削除済みは含まない）。
4. `postRepository.count()` は全 post 件数を返す。
5. `commentRepository.count()` は全 comment 件数を返す。
6. `voteRepository.count()` は全 vote 件数を返す。
7. `subscriptionRepository.count()` は全 subscription 件数を返す。
8. `viewRepository.totalViewCount()` は全期間の累計閲覧数（Post + Comment 分）を返す。
9. `viewRepository.viewCountByCommunity()` は community 別の累計閲覧数 Map を返す（閲覧記録のない community は
   キーを持たない。呼び出し元で 0 件扱いにする）。
10. `GET /api/dashboard` は認証ヘッダなしでも 200 を返す（`requireAuth`/`requireAdmin` を挟まない）。
11. `GET /api/dashboard` のレスポンスはサイト全体サマリ（`community_count` / `worker_count` / `post_count` /
    `comment_count` / `total_view_count` / `total_vote_count` / `total_subscription_count`）と、
    コミュニティ別内訳配列（`community_id` / `slug` / `name` / `post_count` / `subscriber_count` / `view_count`）を
    `view_count` 降順でソートして返す。各値は注入した Repository スタブの返り値と一致する。
12. client `/dashboard` は未ログイン状態でもレンダリングできる（レンダーテストで検証）。
13. client `/dashboard` はサイドバーの主要ナビゲーションから遷移できる。
14. `pnpm --filter @hatchery/server openapi` で `GET /api/dashboard` が `server/openapi.json` に反映される。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### データ取得

`server/src/routes/dashboard.ts` の `createDashboardRouter` が 7 リポジトリ
（community/worker/post/comment/vote/subscription/view）を注入され、`GET /` ハンドラで
`Promise.all` により以下を並列取得する（`workers.ts` の ranking エンドポイントと同じ作法）:

- `communityRepository.list()` + `communityRepository.count()`
- `workerRepository.count()`
- `postRepository.count()` + `postRepository.getStatsByCommunity()`（既存・community 別 postCount 再利用）
- `commentRepository.count()`
- `voteRepository.count()`
- `subscriptionRepository.count()` + `subscriptionRepository.subscriberCountPerCommunity()`（既存・再利用）
- `viewRepository.totalViewCount()` + `viewRepository.viewCountByCommunity()`（新規）

community 一覧を基準に、各 Map から該当 community の値を引いて内訳配列を組み立て、`view_count` 降順でソートする。
最後に `DashboardSummarySchema.parse()` でレスポンス形状を保証する（`community-engagement.ts` と同じ作法）。

### viewCountByCommunity の集計方針（ADR-0032 に整合）

ADR-0032 は「全期間表示が必要な箇所は `viewCount` カラムを直接読む（windowed 集計を回さない）」と定めている。
本 Issue の集計は全期間の累計値のため、raw `PageView` 行の集計ではなく **Post.viewCount / Comment.viewCount
カラムの直接集計**を Prisma 実装で行う（`viewsByWorkerSince` のような 7 日ウィンドウの raw SQL 集計とは別方式）。

- `totalViewCount()`: `prisma.post.aggregate({ _sum: { viewCount: true } })` と comment 側の合計を加算する。
- `viewCountByCommunity()`: Post / Comment を `communityId` で UNION ALL → GROUP BY する raw SQL
  （ADR-0032 の `viewsByWorkerSince` と同じ raw SQL の作法を流用するが、集計元は `PageView` ではなく
  `Post.viewCount` / `Comment.viewCount` カラム）。

in-memory 実装は Post/Comment レコードに `viewCount` フィールドを持たない（既存の `PostRecord` /
`CommentRecord` は ADR-0032 時点で追加されていない）ため、`ViewRepository` 自身が内部に保持する
PageView 相当のレコード数（dedup 済みの新規閲覧イベント数）を代替値として使う。**新規閲覧イベント 1 件 = 本番の
`viewCount` インクリメント 1 回**という対応関係が成立するため、テスト用途としての等価性が保たれる。
`viewCountByCommunity()` の community 解決には、既存の `viewsByWorkerSince` の `resolveAuthor` と同様の
任意コールバック `resolveCommunity`（第 3 引数）を `createInMemoryViewRepository` に追加する
（既存の `// eslint-disable-next-line max-params` の適用範囲を拡張。既存呼び出し元は無変更で動作する）。

### OpenAPI

`server/src/openapi/registrations/registerDashboard.ts` を新設し、`DashboardSummarySchema` をそのまま
1 コンポーネントとして登録する（`registerAdmin.ts` の `CommunityEngagementComponent` と同じ作法。
ネストした配列要素スキーマは個別登録せず、親スキーマに inline させる）。`registry.ts` の末尾に
`registerDashboard(registry, ctx)` を追加する（既存セクションの登録順序は変えない・#535 の作法を踏襲）。
回帰スナップショット（`registry.snapshot.test.ts` / `openapi.baseline.json`）は本 Issue の変更を反映して更新する。

### client

`client/src/routes/DashboardScene.tsx` を新設し、`client/src/api/dashboard.ts` の `useDashboardSummary()`
（`useSuspenseQuery`）でデータ取得する。画面構成:

- 上部: サマリカード群（コミュニティ数・ワーカー数・投稿数・コメント数・累計閲覧数・累計 vote 数・購読数の 7 項目）。
  Vercel Dashboard 風のフラットな枠線ベースのカード（`box-shadow` なし・角丸は 8px 程度に留める）。
- 下部: コミュニティ別内訳テーブル（`view_count` 降順）。Reddit/Linear 風の border-bottom 区切りの
  情報密度重視レイアウト（`WorkerRankingScene.tsx` の `Table` 構成を流用）。
- アクセントカラーは `SLACK_COLORS.blue` のみ使用（見出しアイコン程度に限定）。

`client/src/router.tsx` に公開ルート `/dashboard`（`lazyRouteComponent` + `QueryBoundary`）を追加し、
`client/src/routes/RootLayout.tsx` の `SidebarGlobalNav` に「ダッシュボード」リンクを追加する
（アイコンは `@mui/icons-material/QueryStatsRounded`、Rounded バリアント規約に準拠）。

## 5. 影響範囲 / 既存への変更（対象ワークスペース）

- **common**: 新規 `common/src/domain/dashboard/{dashboard.ts,dashboard.test.ts,index.ts}`。
  `common/src/index.ts` に export 追加。
- **server**:
  - 変更: `communityRepository.ts` / `workerRepository.ts` / `postRepository.ts` / `commentRepository.ts` /
    `voteRepository.ts` / `subscriptionRepository.ts` / `viewRepository.ts`（interface + in-memory 実装）と
    各 `prismaXxxRepository.ts`（Prisma 実装）に `count()` 等を追加。
  - 新規: `server/src/routes/dashboard.ts` + `dashboard.test.ts`。
  - 新規: `server/src/openapi/registrations/registerDashboard.ts`。
  - 変更: `server/src/openapi/registry.ts`（登録追加）、`server/src/app.ts`（route マウント）。
  - 変更: `server/src/openapi/__fixtures__/openapi.baseline.json`（回帰スナップショット更新）。
- **client**:
  - 新規: `client/src/api/dashboard.ts` + テスト、`client/src/routes/DashboardScene.tsx` + テスト。
  - 変更: `client/src/router.tsx`（`/dashboard` ルート追加）、`client/src/routes/RootLayout.tsx`（ナビリンク追加）
    とその既存テスト。
- **docs**: `e2e/usecases.md`（エリア一覧に `dashboard` 追加）、新規 `e2e/dashboard/usecases.md` +
  `e2e/dashboard/dashboard.spec.ts`（`test.todo()`）。

## 6. テスト計画（TDD で書くテスト一覧）

- common: `dashboard.test.ts` — 有効データの parse、各カウントフィールドが負数でエラーになることを確認。
- server persistence（in-memory、先にテストを書き失敗を確認）:
  - `communityRepository.test.ts`: `count()` が 0 件・複数件を返す。
  - `workerRepository.test.ts`: `count()` が論理削除済みを除外して返す。
  - `postRepository.test.ts`: `count()` が全件数を返す。
  - `commentRepository.test.ts`: `count()` が全件数を返す。
  - `voteRepository.test.ts`: `count()` が全件数を返す。
  - `subscriptionRepository.test.ts`: `count()` が全件数を返す。
  - `viewRepository.test.ts`: `totalViewCount()` / `viewCountByCommunity()` の新規閲覧・重複閲覧・community 未解決時の挙動。
- server persistence（Prisma、`describe.skipIf(!DATABASE_URL)` の既存作法。本サンドボックスでは DB 未接続のため
  スキップされるが CI では実行される）: 上記と同等の `count()` / `totalViewCount()` / `viewCountByCommunity()` テストを追加。
- server route: `dashboard.test.ts` — 未認証で 200、スタブ Repository の返り値と一致すること、
  `view_count` 降順ソートを検証。
- server openapi: 既存 `registry.snapshot.test.ts` の baseline 更新で回帰を保証。
- client: `api/dashboard.test.ts`（fetch 成功時の整形）、`routes/DashboardScene.test.tsx`
  （未ログイン状態でのレンダー・サマリカード・テーブル表示）、`RootLayout.test.tsx` へのナビリンク追加検証。

## 7. リスク・未決事項

- 本サンドボックス環境は Node v22（`.nvmrc` は 26）・`DATABASE_URL` 未設定のため、Prisma 統合テストは
  `describe.skipIf` により実行されずスキップされる。CI（DB 接続あり）で初回実行・検証が必要。
- in-memory `viewRepository` の `totalViewCount()` は PageView 相当のイベント数を代替値とする設計判断のため、
  Prisma 実装（`viewCount` カラム直接集計）と数値の出自が異なる。将来 Post/Comment の in-memory レコードに
  `viewCount` フィールドを追加する Issue が出た場合はこの代替実装を見直すこと。
- OpenAPI 回帰スナップショット（`openapi.baseline.json`）は本 Issue のマージ後、次回スキーマ変更 PR で
  引き続き手動更新が必要（既存運用と同じ）。
