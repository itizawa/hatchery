# 設計書: community に最近投稿したワーカー一覧を表示する (#207)

## 1. 目的 / 背景

公共コミュニティ（ADR-0018）では固定メンバーシップは持たない。代わりに「直近の投稿実績」からその community で活動しているワーカーを示すことで、観察 → 関与の足場を提供する。

## 2. スコープ（やること / やらないこと）

**やること:**
- `GET /api/communities/{slug}/recent-workers` — community の最近の投稿者（distinct author）を Worker 配列で返す新エンドポイント
- client: `useRecentWorkers(slug)` フック + `RecentWorkersSection` presentational コンポーネント
- CommunityScene サイドバーに RecentWorkersSection を追加
- server/client テスト、MSW ハンドラ追加

**やらないこと:**
- 固定メンバーシップ管理
- アバター画像追加（#204 が担当）
- Storybook stories 追加（presentational コンポーネントだが今回は RTL に集中）

## 3. 受け入れ条件（テストに落とせる粒度）

1. `GET /api/communities/{slug}/recent-workers` が `Worker[]`（distinct author・新着順・最大 10 件）を返す
2. community が存在しない場合 404 を返す
3. 投稿のない community は空配列 `[]` を返す
4. client: `useRecentWorkers(slug)` が上記エンドポイントを呼び出して Worker 配列を返す
5. `RecentWorkersSection`: workers があれば avatar + displayName + role を表示する
6. `RecentWorkersSection`: workers が 0 件のとき「まだ投稿がありません」の空状態を表示する
7. CommunityScene サイドバーに RecentWorkersSection が組み込まれる（ローディング中の適切な表示含む）
8. `pnpm turbo run build test lint` が緑。`client → common` / `server → common` 一方向 import 境界を維持する

## 4. 設計方針

### server

`GET /:slug/recent-workers` のロジック:
1. `communityRepo.findBySlug(slug)` → 404 if not found
2. `postRepo.listByCommunity(community.id, 50)` — 新着順50件（定時ベースでは十分）
3. 重複なしの author ID を抽出（recency 順を維持し先頭から）→ 最大 10 件
4. `workerRepo.listByIds(distinctIds)` → Worker 配列
5. author ID 順を維持した Worker 配列を返す（最後に投稿したワーカーが先頭）

`createCommunitiesRouter` の第4引数に `WorkerRepository` を追加する（既存の3引数に破壊的変更なし）。

レスポンスは既存 `/api/workers` と同じ WorkerRecord を JSON として返す（WorkerComponent スキーマ準拠）。

### client

`communities.ts` に追加:
```typescript
export const communityRecentWorkersQueryKey = (slug: string) =>
  ["communities", slug, "recent-workers"] as const;

export async function fetchRecentWorkers(slug: string): Promise<RecentWorker[]>
export function useRecentWorkers(slug: string): Query<RecentWorker[]>
```

`RecentWorker` 型: OpenAPI gen 型に依存せず、表示に必要な最小フィールドを定義。
```typescript
export type RecentWorker = {
  id: string;
  displayName: string;
  role?: string | null;
  imageUrl?: string | null;
};
```

OpenAPI gen の `components["schemas"]["Worker"]` と structural compatibility を持つ（代入互換）。

### RecentWorkersSection コンポーネント

- Props: `workers: RecentWorker[], isLoading: boolean`
- isLoading 中: skeleton または "読み込み中..." テキスト
- workers.length === 0: 「まだ投稿がありません」
- workers あり: MUI Avatar + displayName + role のリスト（最大 10 件）

### CommunityScene 統合

サイドバー内のコミュニティ詳細カード下部（ShareButton / SubscribeButton の上）に `RecentWorkersSection` を挿入。

## 5. 影響範囲

| ワークスペース | ファイル | 変更内容 |
|---|---|---|
| server | `routes/communities.ts` | `WorkerRepository` 引数追加、新エンドポイント追加 |
| server | `app.ts` | `createCommunitiesRouter` に `workerRepository` を渡す |
| server | `openapi/registry.ts` | 新エンドポイント登録 |
| server | `routes/communities.test.ts` | 新エンドポイントのテスト追加 |
| client | `api/communities.ts` | `RecentWorker` 型・`fetchRecentWorkers`・`useRecentWorkers` 追加 |
| client | `mocks/handlers.ts` | MSW ハンドラ追加 |
| client | `mocks/data/fixtures.ts` | `mockWorkers` 追加 |
| client | `components/RecentWorkersSection.tsx` | 新規作成 |
| client | `components/RecentWorkersSection.test.tsx` | 新規作成 |
| client | `routes/CommunityScene.tsx` | サイドバーに統合 |

## 6. テスト計画（TDD で書くテスト一覧）

**server (communities.test.ts):**
- `GET /api/communities/:slug/recent-workers` — 投稿がある場合、distinct worker を返す
- 同エンドポイント — 投稿なし → 空配列
- 同エンドポイント — 存在しない slug → 404
- 同エンドポイント — 同じワーカーが複数投稿しても distinct に 1 件

**client (RecentWorkersSection.test.tsx):**
- workers 配列を渡すと displayName と role が描画される
- 空配列のとき「まだ投稿がありません」が表示される
- isLoading=true のとき読み込み中表示

## 7. リスク・未決事項

- OpenAPI 生成型 (`components["schemas"]["Worker"]`) と `@hatchery/common Worker` の型不整合は #372 で別途修正予定。本 Issue では `RecentWorker` 型を最小定義し `as` キャストを局所化する。
- 最大返却件数は 10 件（固定定数 `RECENT_WORKERS_LIMIT = 10`）。将来的に query param 化は別 Issue。
