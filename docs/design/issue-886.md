# 設計書: コミュニティフィードに投票数順ソート（popular）を追加する (#886)

## 1. 目的 / 背景

`GET /api/communities/:slug/feed` は `sort` クエリを完全無視し、常に新着順を返す。
ホームフィード（`/api/feed`）には `sort=latest|popular` が実装済みであり、同パターンをコミュニティフィードにも適用する。

## 2. スコープ（やること / やらないこと）

**やること**

- `CommunityFeedQuerySchema` に `sort: latest|popular` を追加
- `PostRepository` に `listByCommunityPopularPaged` メソッドを追加（score 降順 → createdAt 降順 → id 降順）
- サーバールートで `sort` に応じて `listByCommunityPaged` / `listByCommunityPopularPaged` を呼び分け
- OpenAPI に `sort` クエリパラメータを追加
- クライアント `communityFeedQueryKey` に sort を含め、sort ごとにキャッシュを分離
- `useInfiniteCommunityFeed` / `fetchCommunityFeedPage` で `sort` を受け取る
- `CommunityScene.tsx` に「新着 / 人気」タブを追加

**やらないこと**

- hot アルゴリズム（時間減衰）の導入
- sort 状態の URL クエリパラメータ化（Phase 1 拡張）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `GET /api/communities/:slug/feed?sort=popular` が vote スコア降順（score DESC → createdAt DESC → id DESC）で投稿を返す
2. `GET /api/communities/:slug/feed?sort=latest`（または sort 省略）は従来の新着順（createdAt DESC → id DESC）を返す
3. `CommunityFeedQuerySchema` が `sort=popular` を受け入れ、デフォルト `"latest"` で parse される
4. `communityFeedQueryKey(slug, sort)` が sort ごとに異なるキーを生成し、キャッシュが分離される
5. `CommunityScene.tsx` に「新着」「人気」タブがあり、切り替えで feed の sort が変わる
6. `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### データフロー

```
CommunityFeedQuerySchema（sort=popular）
  → server/routes/communities.ts（sort を解析）
  → postRepo.listByCommunityPopularPaged（score 降順）
  → OpenAPI 経由でクライアントへ
  → useInfiniteCommunityFeed(slug, "popular")
  → communityFeedQueryKey(slug, "popular") = ["communities", slug, "feed", "popular"]
```

### 選択肢の比較（`listByCommunityPaged` に sort 引数追加 vs 新メソッド追加）

- ホームフィード（`listLatestPaged` / `listPopularPaged`）が別メソッドであるため、コミュニティフィードも `listByCommunityPopularPaged` として別メソッドを追加し一貫性を保つ。
- cursor スキーマが latest（`{ createdAt, id }`）と popular（`{ score, createdAt, id }`）で異なるため、分離が自然。

### cursor スキーマ

- latest: `encodeCursor` / `decodeCursor`（`{ createdAt, id }`）— 既存
- popular: `encodePopularCursor` / `decodePopularCursor`（`{ score, createdAt, id }`）— 既存ヘルパーを流用

## 5. 影響範囲 / 既存への変更

| ファイル | 変更内容 |
|---------|----------|
| `common/src/domain/feed/feed.ts` | `CommunityFeedQuerySchema` に `sort` 追加、`CommunityFeedSort` 型エクスポート |
| `server/src/persistence/postRepository.ts` | `listByCommunityPopularPaged` をインターフェース・inMemory 実装に追加 |
| `server/src/persistence/prismaPostRepository.ts` | `listByCommunityPopularPaged` を Prisma 実装に追加 |
| `server/src/routes/communities.ts` | `sort` を取り出し、popular 時は `listByCommunityPopularPaged` を呼ぶ |
| `server/src/openapi/registrations/registerCommunities.ts` | community feed の query に `sort` を追加 |
| `client/src/api/feed.ts` | `communityFeedQueryKey`・`fetchCommunityFeedPage`・`useInfiniteCommunityFeed` を sort 対応 |
| `client/src/routes/CommunityScene.tsx` | 「新着 / 人気」タブ UI を追加 |
| `e2e/community/usecases.md` | UC-COMM-29 を追加 |

## 6. テスト計画（TDD で書くテスト一覧）

1. `common/src/domain/feed/feed.test.ts`: `CommunityFeedQuerySchema` の `sort` 境界テスト
2. `server/src/routes/communities.test.ts`: `sort=popular` で score 降順が返ることのルートテスト
3. `client/src/routes/CommunityScene.test.tsx`: 「新着 / 人気」タブ切り替えのコンポーネントテスト

## 7. リスク・未決事項

- `#881` が前提（コミュニティフィードのページネーション）: 実装済みのため問題なし
- OpenAPI スナップショットテスト（`registry.snapshot.test.ts`）が変更を検出する可能性あり → スナップショット更新で対応
