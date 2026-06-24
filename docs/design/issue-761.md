# 設計書: コミュニティ帰属シグナルを計測する (#761)

## 1. 目的 / 背景

ADR-0033 でマネタイズ軸を「コミュニティ後援（パトロネージュ）」に置くと決めた。しかし「後援課金の前に愛着が出るかを計測で検証する」必要がある。本 Issue はその計測土台（ダッシュボード）を admin に提供する。

## 2. スコープ（やること / やらないこと）

### やること
- `GET /api/admin/community-engagement` エンドポイントを追加（admin 限定）
- 以下の3シグナルを集計して返す:
  - **vote集中度（コミュニティ別）**: 直近 N 日の community 別 vote 数と全体シェア
  - **vote集中度（ワーカー別）**: 直近 N 日の worker 別 vote 数と全体シェア
  - **独占的ロイヤリティ**: ユーザーごとの community vote 集中度（最大シェア）の平均
- 集計ウィンドウ（N 日）は名前付き定数で切り出す
- 集中度・シェア計算の純粋ロジックを `common` に切り出し、ユニットテストする
- OpenAPI 一方向フロー（common Zod → openapi.json → client 型生成）に乗せる
- admin 画面に新タブ「帰属シグナル」を追加し、表で表示する
- RTL テストでシグナル要素の描画を検証する
- e2e/admin usecases を更新する

### やらないこと
- 「コミュニティリテンション」の厳密な再訪率計測（PageView の時系列を追うと複雑すぎるため、スコープ外）
  - 代替として subscription 数と vote 数を並記し、後援判断の材料とする
- スクショ共有等のアプリ外計測
- 実際の課金（別 Issue）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `GET /api/admin/community-engagement` が 401（未認証）・403（非 admin）・200（admin）を正しく返す
2. `computeVoteShares` は counts から `{ id, count, sharePercent }[]` を降順で返す
3. `computeLoyaltyScore` はユーザー毎の vote 最大シェアの平均を 0–1 で返す（ユーザーなし → 0）
4. API レスポンスに `communityVotes`, `workerVotes`, `loyaltyScore`, `windowDays` が含まれる
5. admin 画面の「帰属シグナル」タブに `data-testid="community-engagement-tab"` 要素が描画される
6. `pnpm turbo run build test lint` 緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### 純粋ロジック（common）

```typescript
// common/src/logic/computeEngagementSignals.ts

/** ID 別集計 counts から share % 付きで降順リストを生成する */
export function computeVoteShares({
  counts,
}: {
  counts: ReadonlyMap<string, number>;
}): Array<{ id: string; count: number; sharePercent: number }>;

/** ユーザーごとの community vote 集中度（最大シェア）の平均（0–1）を返す */
export function computeLoyaltyScore({
  userVotesByCommunity,
}: {
  userVotesByCommunity: ReadonlyMap<string, ReadonlyMap<string, number>>;
}): number;
```

### VoteRepository の拡張（server）

```typescript
// voteRepository.ts に追加
/** 指定日時以降の vote をユーザー×コミュニティ単位で集計する（ロイヤリティ計算用）*/
voteCountsPerUserPerCommunitySince(
  since: Date
): Promise<Map<string, Map<string, number>>>;
```

Prisma 実装は `groupBy` + `_count` を使って post/comment 経由で communityId を引く。

### SubscriptionRepository の拡張（server）

```typescript
/** コミュニティ別購読数 (communityId → count) を返す */
subscriberCountPerCommunity(): Promise<Map<string, number>>;
```

### API レスポンス Zod スキーマ（common）

```typescript
// common/src/domain/communityEngagement/index.ts
export const CommunityEngagementSchema = z.object({
  windowDays: z.number().int().positive(),
  communityVotes: z.array(z.object({
    communityId: z.string(),
    count: z.number().int().nonnegative(),
    sharePercent: z.number(),
  })),
  workerVotes: z.array(z.object({
    workerId: z.string(),
    count: z.number().int().nonnegative(),
    sharePercent: z.number(),
  })),
  loyaltyScore: z.number().min(0).max(1),
  subscriberCountByCommunity: z.record(z.number().int().nonnegative()),
});
```

### 定数（server 側）

```typescript
export const ENGAGEMENT_WINDOW_DAYS = 30; // ADR-0030 の VOTE_WEIGHT_WINDOW_DAYS に倣う
```

## 5. 影響範囲 / 既存への変更

| ワークスペース | 変更内容 |
|---|---|
| common | 新規: `domain/communityEngagement/`, `logic/computeEngagementSignals.ts` |
| server | 拡張: `voteRepository.ts`, `prismaVoteRepository.ts`, `subscriptionRepository.ts`, `prismaSubscriptionRepository.ts`; 新規: `routes/community-engagement.ts`; 変更: `openapi/registrations/registerAdmin.ts`, `app.ts` |
| client | 新規: `api/communityEngagement.ts`; 変更: `routes/settingsTabValues.ts`, `routes/SettingsScene.tsx` |

## 6. テスト計画（TDD で書くテスト一覧）

| テスト | ファイル |
|---|---|
| computeVoteShares: 正常系（counts Map から sharePercent 算出） | common/src/logic/computeEngagementSignals.test.ts |
| computeVoteShares: 空 Map → 空配列 | 同上 |
| computeLoyaltyScore: 1 ユーザー 1 community → 1.0 | 同上 |
| computeLoyaltyScore: 1 ユーザー 2 community 均等 → 0.5 | 同上 |
| computeLoyaltyScore: ユーザーなし → 0 | 同上 |
| GET /api/admin/community-engagement: 未認証 → 401 | server/src/routes/community-engagement.test.ts |
| GET /api/admin/community-engagement: 非 admin → 403 | 同上 |
| GET /api/admin/community-engagement: admin → 200 with correct shape | 同上 |
| CommunityEngagementTab に data-testid 要素が描画される | client/src/api/communityEngagement.test.ts |

## 7. リスク・未決事項

- Prisma の `groupBy` で post / comment 双方の communityId を扱うため、UNION 相当の raw query が必要になる可能性がある。複雑化した場合は community 別 netScore（既存の `netScoresByCommunitySince`）で代替する。
- 本番データ量が大きい場合 `voteCountsPerUserPerCommunitySince` が重くなりうる。MVP ではウィンドウを 30 日に絞り、index 追加でカバーする。インデックスは既存 `@@index([createdAt])` を利用。
