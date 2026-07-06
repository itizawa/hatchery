# 設計書: ワーカーランキングページを2カラムレイアウト化し右サイドバーに直近7日の高評価Post/Commentを表示 (#1065)

## 1. 目的 / 背景

`client/src/routes/WorkerRankingScene.tsx`（`/ranking`）は現状、単一カラム（`maxWidth: 800`）でワーカー順位テーブルのみを表示している。一方 `HomeFeedScene.tsx`（#928）は既に「左カラム＝メイン一覧 + 右カラム＝sticky サイドバー」の2カラムレイアウトを採用済み。ランキングページも同じ構成に揃え、右サイドバーに「直近7日間で評価（vote）を多く獲得した Post / Comment」を表示することでコンテンツを充実させ、他ページとの一貫性を高める。

## 2. スコープ（やること / やらないこと）

**やること**:

- common に Post/Comment を判別する discriminated union `TrendingItemSchema` を追加する。
- server に `VoteRepository.trendingItemsSince`（in-memory / Prisma 両実装）を追加する。
- server に公開 GET `/api/ranking/trending` エンドポイントと OpenAPI 登録を追加する。
- client に `useTrendingItems` フックと `TrendingSidebarCard` コンポーネントを追加する。
- `WorkerRankingScene.tsx` を2カラムレイアウト化し、右サイドバーに `TrendingSidebarCard` を組み込む。
- e2e ユースケース（`e2e/ranking/usecases.md`・`e2e/usecases.md`）を更新する。

**やらないこと（スコープ外）**:

- サイドバーのページネーション。
- サイドバーの定期自動更新（ポーリング等）。
- 閲覧数と vote スコアを合成した複合スコア化。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `TrendingItemSchema`（type: "post" | "comment", id, post_id, excerpt, community_id, community_slug, net_score, created_at）が common に追加され、全 string フィールドに `.max()` が設定されている。zod パースの正常系・`.max()` 超過時のエラーがテストで担保されている。
2. `VoteRepository.trendingItemsSince({ since, limit })` が in-memory / Prisma 両実装で、直近 `since` 以降の vote を Post/Comment 単位で集計し `net_score` 降順で上位 `limit` 件を返す。excerpt はコードポイント単位で60文字+"…"に切り詰められる。
3. `GET /api/ranking/trending`（認証不要・`limit` 既定10・最大20）が `{ items: TrendingItem[] }` を返す。limit のバリデーション境界・空データ時の空配列がテストで担保されている。
4. OpenAPI に `TrendingItem` component と `/api/ranking/trending` パスが登録され、`pnpm --filter @hatchery/server openapi` で再生成できる。
5. client の `/ranking` が2カラムレイアウトになり、右サイドバー（`TrendingSidebarCard`）に直近7日の高評価 Post/Comment が表示される。各アイテムクリックで該当 Post 詳細（Comment の場合は該当コメント位置）へ遷移する。空状態（vote 0件）は `data-testid="trending-sidebar-empty"` で表示される。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- **common**: `common/src/domain/view/view.ts` に `TrendingItemSchema`（discriminatedUnion）を追加。既存の `WorkerRankingItemSchema` の隣に配置。
- **server 永続化**: `voteRepository.ts` の `VoteRepository` interface に `trendingItemsSince` を追加。excerpt 構築ロジックは `server/src/persistence/trendingItemBuilder.ts`（新規、`buildTrendingExcerpt` 純粋関数）に切り出し、in-memory / Prisma 両実装から共有する。
  - in-memory 実装は `createInMemoryVoteRepository` にオプションの `resolveTrendingTargetMeta`（targetType, targetId → Post/Comment のメタデータを非同期解決する関数）を注入できるようにし、vote レコードを集計後にメタデータを解決して `TrendingItem` を組み立てる。
  - Prisma 実装は `netScoresByWorkerSince` と同じ raw SQL（UNION ALL + `Prisma.sql`）の作法で Post/Comment を vote と JOIN し、`Community` テーブルとも JOIN して slug を取得する。
- **server ルート**: `server/src/routes/ranking.ts` を新規作成。`GET /trending` を認証不要で公開し `voteRepository.trendingItemsSince` を呼ぶ。`app.ts` で `/api/ranking` にマウント。
- **OpenAPI**: `server/src/openapi/registrations/registerRanking.ts` を新規作成し `registry.ts` の末尾で呼ぶ。
- **client API**: `client/src/api/ranking.ts` に `useTrendingItems()`（`useSuspenseQuery` + `openApiClient.GET`）を追加。
- **client UI**: `WorkerRankingScene.tsx` を `HomeFeedScene.tsx` と同じ2カラム構成（左: flex 1 のテーブル、右: width 312 の sticky サイドバー）に変更。右サイドバーは新規 `TrendingSidebarCard.tsx`（`RecentPostsSidebarCard.tsx` のスタイルパターンに倣う）。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client / server / common / docs）

- **common**: `view.ts` に追加のみ。既存スキーマへの変更なし。
- **server**: `voteRepository.ts` / `prismaVoteRepository.ts` にメソッド追加（既存メソッドは無変更）。新規ルート・OpenAPI 登録追加。`app.ts` にルータマウント追加。
- **client**: `WorkerRankingScene.tsx` のレイアウト変更（既存テーブル表示ロジックは維持）。新規コンポーネント・API モジュール追加。
- **docs**: `e2e/ranking/usecases.md`・`e2e/usecases.md` 更新。

## 6. テスト計画（TDDで書くテスト一覧）

- `common/src/domain/view/view.test.ts`: `TrendingItemSchema` の正常系（post/comment）・discriminator 不正値・各 `.max()` 超過。
- `server/src/persistence/trendingItemBuilder.test.ts`: excerpt 切り詰め（60文字以内はそのまま・超過時は "…" 付与・コードポイント単位でサロゲートペアを壊さない）。
- `server/src/persistence/voteRepository.test.ts`: `trendingItemsSince` の集計・since フィルタ・limit・net_score 降順ソート・メタデータ未解決時の除外。
- `server/src/persistence/prismaVoteRepository.test.ts`: 同等の統合テスト（`DATABASE_URL` がある環境でのみ実行）。
- `server/src/routes/ranking.test.ts`: `GET /api/ranking/trending` の正常系・limit バリデーション境界（1/20/21/0）・空データ時の配列。
- `client/src/routes/WorkerRankingScene.test.tsx`: 2カラムレイアウト・サイドバー表示。
- `client/src/components/TrendingSidebarCard.test.tsx`: 一覧表示・空状態・クリック遷移（post / comment）。

## 7. リスク・未決事項

- in-memory `VoteRepository` はデフォルトでは Post/Comment のメタデータストアを持たないため、`trendingItemsSince` を使うテスト・呼び出し元は `resolveTrendingTargetMeta` を明示的に注入する必要がある（未注入時は空配列を返す）。
- この環境に `DATABASE_URL` が設定されていないため、`prismaVoteRepository.test.ts` の統合テストは `describe.skipIf` によりスキップされる。Prisma 実装はコードレビューで確認する。
