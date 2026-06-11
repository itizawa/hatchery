# 設計書: 定時バッチ（シーン生成）を定時に自動実行する（外部スケジューラ配線） (#388)

## 1. 目的 / 背景

生成ロジック・バッチ本体 (`server/src/batch/communityBatchIndex.ts`) は実装済みだが、
外部スケジューラから呼ばれていない。手動で `pnpm --filter @hatchery/server batch` を
実行しないと生成が走らない状態で、「放置して眺める観察エンタメ」の前提を満たしていない。
外部スケジューラを配線して 1 日数回自動生成されるようにする（ADR-0009 / ADR-0018）。

## 2. スコープ（やること / やらないこと）

**やること**:
- GitHub Actions scheduled workflow (`.github/workflows/run-batch.yml`) の追加
- `docs/deploy/setup.md` への定時実行設定手順の追記
- in-process スケジューラ (`schedule.ts` の `startMessageBatchScheduler`) が Express に組み込まれていないことを確認・テストで担保

**やらないこと**:
- 生成ロジック自体の変更・コスト最適化（#389）
- Cloud Scheduler → Cloud Run Job 方式の実装（GitHub Actions cron で足りる）
- in-process スケジューラ (`schedule.ts`) の Express 組み込み（ADR-0009/0018 違反になるため）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `.github/workflows/run-batch.yml` が存在し、valid な YAML である
2. schedule トリガーの cron が DEFAULT_BATCH_HOURS [9,12,15,18] JST の UTC 換算と整合する
   - 9 JST = 0 UTC, 12 JST = 3 UTC, 15 JST = 6 UTC, 18 JST = 9 UTC
   - 具体的に `0 0,3,6,9 * * *` を含む（または等価の個別 cron 4 本）
3. workflow が `pnpm --filter @hatchery/server batch` を実行するステップを含む
4. ANTHROPIC_API_KEY / DATABASE_URL が secrets 経由で渡される（平文なし）
5. `server/src/app.ts` / `server/src/server.ts` が `startMessageBatchScheduler` を呼んでいない
   （in-process スケジューラ未組み込みを CI で担保）
6. slot_key による二重発火ガードは既存テスト (`runCommunityBatch.test.ts`) で担保済み
7. `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### 外部スケジューラ方式の選定

| 方式 | メリット | デメリット |
|------|---------|----------|
| GitHub Actions cron | インフラ追加ゼロ・既存 secrets/WIF 再利用 | UTC 固定・ GitHub Actions が止まると生成も止まる |
| Cloud Scheduler → Cloud Run Job | 安定・独立稼働 | GCP インフラ設定追加が必要 |

**採用: GitHub Actions cron**。MVP 規模では GitHub Actions cron が最小コスト・最速導入。
`deploy-server-dev.yml` で確立した Node/pnpm/secrets パターンをそのまま流用できる。

### in-process スケジューラについて

`schedule.ts` の `startMessageBatchScheduler` / `createSystemScheduler` は Cloud Run の
scale-to-zero 環境では `setTimeout` が破棄され定時を取りこぼすため、Express サーバに組み込まない。
実装は既にそうなっているが、テストで静的に担保する。

### タイムゾーン換算

GitHub Actions cron は UTC 固定。DEFAULT_BATCH_HOURS = [9, 12, 15, 18] JST (UTC+9):
- 9 JST → 0 UTC → `0 0 * * *`
- 12 JST → 3 UTC → `0 3 * * *`
- 15 JST → 6 UTC → `0 6 * * *`
- 18 JST → 9 UTC → `0 9 * * *`

schedule: `- cron: '0 0,3,6,9 * * *'` でまとめて表現。

## 5. 影響範囲 / 既存への変更

- **新規**: `.github/workflows/run-batch.yml`
- **更新**: `docs/deploy/setup.md`（定時実行設定手順の追記）
- **新規**: `tests/run-batch-workflow.test.ts`（ワークフロー構造検証）
- **変更なし**: `server/src/batch/` 配下・`app.ts` / `server.ts`

## 6. テスト計画（TDD で書くテスト一覧）

`tests/run-batch-workflow.test.ts`:
1. `.github/workflows/run-batch.yml` が存在する
2. valid YAML である
3. schedule.cron に UTC 換算時刻 (0,3,6,9 UTC) が含まれる
4. `pnpm --filter @hatchery/server batch`（またはバリアント）を実行するステップが存在する
5. ANTHROPIC_API_KEY が `secrets.ANTHROPIC_API_KEY` 経由で渡される
6. DATABASE_URL が `secrets.DATABASE_URL` 経由で渡される

`tests/batch-scheduler-not-in-server.test.ts`:
7. `server/src/server.ts` が `startMessageBatchScheduler` を import/呼び出ししていない
8. `server/src/app.ts` が `startMessageBatchScheduler` を import/呼び出ししていない

既存テスト:
- `server/src/batch/runCommunityBatch.test.ts` の「二重発火ガード」テストが継続して緑

## 7. リスク・未決事項

- GitHub Actions cron は UTC で管理するため、夏時間の影響はない（JST は UTC+9 固定）
- GitHub Actions cron は正確な時刻を保証しない（最大数十分の遅延あり）。slot_key は分単位のため、
  遅延があっても同一 slot に入れば二重発火ガードが機能する
- `BATCH_SCHEDULE` 環境変数による時刻上書きは今回スコープ外（デフォルト値で固定）
