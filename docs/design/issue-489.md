# 設計書: Issue #489 定時バッチが WorkerCommunity 経由で community 別ワーカーを DB から取得して生成する

## 背景・目的

定時バッチ（`server/src/batch/runCommunityBatch.ts`）は現状ワーカーを `deps.workers ?? DEFAULT_WORKERS` で解決しており、CLI（`communityBatchIndex.ts`）が `workers` を注入しないため、常に `@hatchery/common` のハードコード定数 `DEFAULT_WORKERS`（haru / ken / mei）が使われ、DB の `workers` テーブルを一切見ない。

本 Issue では `WorkerCommunity`（worker ↔ community の参加テーブル）を導入し、community ごとにその community に参加するワーカーを **DB から取得**して会話生成・author 検証に使う。これにより admin が community 単位でワーカーを編成できるデータ基盤を整える（編集 UI は別 Issue）。

## スコープ

- IN: `WorkerCommunity` モデル + マイグレーション / `WorkerCommunityRepository`（InMemory + Prisma） / community 別ワーカー解決のドメインロジック（common・TDD） / `runCommunityBatch` を DB ベースに切替。
- OUT: 管理画面の参加コミュニティ編集 UI（別 Issue）、Zenn フィード取り込み（別 Issue）。

## データモデル（受け入れ条件 1）

`prisma/schema.prisma` に join テーブルを追加する。

```prisma
/// ワーカーの community 参加（#489）。worker ↔ community の多対多中間テーブル。
/// 定時バッチはこの紐づきから community ごとの登場ワーカーを解決する。
model WorkerCommunity {
  workerId    String
  worker      Worker    @relation(fields: [workerId], references: [id], onDelete: Cascade)
  communityId String
  community   Community @relation(fields: [communityId], references: [id], onDelete: Cascade)
  createdAt   DateTime  @default(now())

  @@id([workerId, communityId])
  @@index([communityId])
  @@map("worker_communities")
}
```

`Worker` / `Community` 側に逆リレーション `workerCommunities WorkerCommunity[]` を追加する。

マイグレーション `prisma/migrations/<timestamp>_add_worker_community/migration.sql` で `worker_communities` テーブル・複合主キー・community 索引・2 本の FK（onDelete CASCADE）を作成する。これにより本番/stg にデプロイ可能な状態にする。

## 永続化（受け入れ条件 2 / 4）

`server/src/persistence/workerCommunityRepository.ts` に port + InMemory を、`prismaWorkerCommunityRepository.ts` に Prisma 実装を置く（ADR-0024 の関数ファクトリ規約に従う・クラス禁止）。

```ts
export interface WorkerCommunityRepository {
  /** community に紐づく有効な（論理削除されていない）ワーカーを返す。 */
  listWorkersByCommunity(communityId: string): Promise<WorkerRecord[]>;
}
```

Prisma 実装は `worker_communities` を `communityId` で引き、`worker.deletedAt = null` のワーカー行を JOIN して `WorkerRecord[]` を返す。

## ドメインロジック（受け入れ条件 3 / 5・common で TDD）

`common/src/domain/worker/selectCommunityWorkers.ts` に純粋関数を置く。

```ts
export function selectCommunityWorkers<W extends { id: string }>(
  communityWorkers: readonly W[],
  allBotWorkers: readonly W[],
): readonly W[];
```

- community に紐づくワーカーが 1 件以上 → それをそのまま返す。
- **0 件 → フォールバックで全 Bot ワーカーを返す**（受け入れ条件 3 で要求される「決め」: 生成スキップではなく全 Bot ワーカーを対象にする）。理由: stg 移行期や WorkerCommunity 未登録 community でも会話生成を止めない方が観察エンタメとして自然で、既存の「DEFAULT_WORKERS フォールバック」の精神を DB ベースに引き継げるため。
- 全 Bot ワーカーも 0 件なら空配列（呼び出し側で生成スキップ）。

`common/src/domain/worker/index.ts` から再エクスポートし、`@hatchery/common` 経由で server が参照できるようにする（import 境界 server→common を維持）。

## バッチ本体の変更（受け入れ条件 2 / 4 / 5）

`runCommunityBatch` の deps に以下を追加する。

- `workerCommunityRepo: WorkerCommunityRepository`（必須・community 別ワーカー取得）。
- `botWorkerProvider?: () => Promise<readonly WorkerDef[]>`（フォールバック用の全 Bot ワーカー取得。CLI では `workerRepo.listBotWorkers` を渡す）。
- 既存の `workers?: readonly WorkerDef[]` は**移行期/テスト用デフォルト注入**として残す（受け入れ条件 5 が許可）。ただし生成経路から `DEFAULT_WORKERS` への直接 import は削除する。

community ループ内で:

1. `const communityWorkers = await deps.workerCommunityRepo.listWorkersByCommunity(community.id)`
2. `const botWorkers = communityWorkers.length > 0 ? [] : (await deps.botWorkerProvider?.() ?? deps.workers ?? [])`
3. `const workers = selectCommunityWorkers(communityWorkers, botWorkers)`
4. `workers` が 0 件ならその community をスキップ（生成しない）。
5. `buildCommunityPrompt({ community, workers, recentLog })` の `workers` と `validateGenerationOutput(output, workers.map(w => w.id))` の id 集合に使う。

author 検証は DB 由来のワーカー id 集合で行い、未知 author の post/comment を含む出力はスキップする（既存仕様を DB ベースで踏襲）。

## CLI への配線（`communityBatchIndex.ts`）

`main()` で `createPrismaWorkerCommunityRepository(prisma)` と `createPrismaWorkerRepository(prisma)` を生成し、`workerCommunityRepo` と `botWorkerProvider: () => workerRepo.listBotWorkers()` を `batchDeps` に渡す。これで CLI が DB のワーカー編成を使うようになる。

## 受け入れ条件と検証の対応

| # | 内容 | 検証 |
|---|------|------|
| 1 | WorkerCommunity をマイグレーションで適用可能に | schema + migration 追加、`prisma migrate` で適用可能 |
| 2 | community 別ワーカーを DB から取得しプロンプト/検証に使う | `runCommunityBatch.test.ts` で workerCommunityRepo 経由の解決を検証 |
| 3 | 0 件フォールバックをテストで固定（全 Bot ワーカー対象に決定） | `selectCommunityWorkers.test.ts` + batch テストで固定 |
| 4 | author 検証を DB id 集合で行い未知 author をスキップ | batch テスト（community 別 id 集合で検証） |
| 5 | 生成経路から DEFAULT_WORKERS 直接依存を外す | runCommunityBatch から DEFAULT_WORKERS import 削除、grep で確認 |
| 6 | build/test/lint 緑・server→common 一方向 import | turbo + 規約テスト |

## TDD 計画

1. `common` の `selectCommunityWorkers` テスト（紐づきあり/0件フォールバック/全Bot0件）→ 失敗 → 実装。
2. `workerCommunityRepository`（InMemory）テスト → 失敗 → 実装。
3. `runCommunityBatch` テスト（community 別ワーカー解決・0件フォールバック・未知 author スキップ）→ 失敗 → 実装。
4. `communityBatchIndex` の配線は既存テストの依存追加に追従。
5. prisma 実装は `DATABASE_URL` 無しでは skip される integration テストを追加（既存パターン踏襲）。

## ユーザー可視の振る舞い

本 Issue はバックエンド（バッチのワーカー解決経路）の変更で、画面・操作・空状態表示は変えない。admin がまだ参加編成を編集する UI を持たないため、ユーザー可視挙動は不変。よって `e2e/` ユースケースの更新は不要（PR に明記する）。
