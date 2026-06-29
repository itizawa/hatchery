# 設計書: コミュニティ一覧・詳細ヘッダーに購読者数を表示し社会的証明を加える (#930)

## 1. 目的 / 背景

`GET /api/communities` の `subscriber_count` フィールドが常に `null` を返しており、UI に購読者数が表示されていない。
新規ユーザーがコミュニティ一覧を見たとき「どこが賑わっているか」を判断できる情報として、購読者数を実数値で返し表示する。

## 2. スコープ（やること / やらないこと）

**やること**
- server: `toCommunityResponse` に購読者数を付与する
- server: `GET /api/communities` ハンドラで `subscriberCountPerCommunity()` を一括集計して渡す（N+1 回避）
- common: `CommunitySchema` に `subscriber_count: z.number().int().min(0)` を追加
- client: コミュニティ一覧カード（`CommunityBrowseScene.tsx`）に「N 購読者」を表示
- client: コミュニティ詳細ヘッダー（`CommunityHeader.tsx`）に「N 購読者」を表示
- e2e: UC-COMM-25 を追加

**やらないこと**
- 「アクティブ購読者数」の定義変更（直近 7 日のみカウント等）
- 購読者の一覧表示
- `post_count / subscriber_count` の比率指標（将来拡張）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `GET /api/communities` レスポンスの各要素に `subscriber_count` が数値で含まれる
2. 購読者が 0 件のコミュニティは `subscriber_count: 0` を返す
3. 購読者がいるコミュニティは正しい件数を返す
4. 複数コミュニティがある場合、それぞれ独立した `subscriber_count` を返す（N+1 回避）
5. コミュニティ一覧 UI に「N 購読者」が表示される
6. コミュニティ詳細ヘッダーに「N 購読者」が表示される
7. `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### 一括集計パターン（N+1 回避）

`postRepo.getStatsByCommunity()` が `Map<string, CommunityPostStats>` を返すのと同様に、
`subscriptionRepo.subscriberCountPerCommunity()` が `Map<string, number>` を返す実装が既にある。

`GET /api/communities` ハンドラの `Promise.all` に `subscriberCountPerCommunity()` を追加し、
`Map.get(c.id) ?? 0` で各コミュニティへ値を注入する。

### `toCommunityResponse` の変更

既存の `// eslint-disable-next-line max-params` コメントはそのまま維持し、3 番目の引数 `subscriberCount = 0` を追加する。

### CommunitySchema の変更

`subscriber_count: z.number().int().min(0)` を追加。
OpenAPI ベースラインフィクスチャ（`openapi.baseline.json`）を `pnpm --filter @hatchery/server openapi` 出力で更新する。

### クライアント表示

- `CommunityBrowseScene.tsx`: 活気指標の行に「N 購読者」を追加（`PeopleAltRounded` アイコン）
- `CommunityHeader.tsx`: コミュニティ名下の説明テキスト行に「N 購読者」を追加

## 5. 影響範囲 / 既存への変更

| ファイル | 変更内容 |
|---------|--------|
| `common/src/domain/community/community.ts` | `CommunitySchema` に `subscriber_count` 追加 |
| `server/src/routes/communityResponse.ts` | 第 3 引数 `subscriberCount` 追加 |
| `server/src/routes/communities.ts` | `Promise.all` に `subscriberCountPerCommunity()` 追加 |
| `server/src/openapi/__fixtures__/openapi.baseline.json` | `subscriber_count` フィールド追加によるスナップショット更新 |
| `client/src/components/CommunityHeader.tsx` | 購読者数表示追加 |
| `client/src/routes/CommunityBrowseScene.tsx` | 購読者数表示追加 |
| `e2e/community/usecases.md` | UC-COMM-25 追加 |

## 6. テスト計画（TDD で書くテスト一覧）

- `server/src/routes/communities.test.ts`
  - 購読者が 0 件の community は `subscriber_count: 0` を返す（#930）
  - 購読者がいる community は正しい `subscriber_count` を返す（#930）
  - 複数 community がある場合それぞれ独立した `subscriber_count` を返す（N+1 回避・#930）

## 7. リスク・未決事項

- なし。`subscriberCountPerCommunity()` は InMemory / Prisma 両実装が既に存在し、テスト注入可能。
