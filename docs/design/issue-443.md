# 設計書: 定時バッチ workflow ERR_MODULE_NOT_FOUND 修正 (#443)

## 1. 目的 / 背景

`.github/workflows/run-batch.yml` は `pnpm install --frozen-lockfile` の直後に
`pnpm --filter @hatchery/server batch` を実行しているが、`@hatchery/server` の
`batch` スクリプト（`tsx src/batch/communityBatchIndex.ts`）は実行時に以下を必要とする。

- `@hatchery/common` の `dist/index.js`（common の `exports.default` が指すビルド成果物）
- Prisma Client（`@prisma/client`。`prisma generate` で生成）

`pnpm install` だけではこれらは存在しないため、`ERR_MODULE_NOT_FOUND` で落ちる。

## 2. スコープ（やること / やらないこと）

**やること**:
- `run-batch.yml` に `@hatchery/common` ビルド + Prisma Client 生成ステップを追加
- `tests/run-batch-workflow.test.ts` にリグレッション防止テストを追加

**やらないこと**:
- バッチ起動基盤の Cloud Scheduler 移行（#444 で対応）
- バッチスクリプト本体のロジック変更

## 3. 受け入れ条件（テストに落とせる粒度）

1. `pnpm turbo run build --filter=@hatchery/server` ステップ（common ビルド + Prisma generate を含む）がバッチ実行ステップの前にある
2. common ビルドステップが「batch 実行ステップより前に存在する」ことを tests/ で検証
3. `pnpm turbo run build test lint` が緑

## 4. 設計方針

### ビルドステップの選択

`pnpm turbo run build --filter=@hatchery/server` を採用する。

- `turbo.json` の `build` タスクは `"dependsOn": ["^build"]` なので、
  `@hatchery/server#build` 実行前に `@hatchery/common#build` が保証される
- server の `build` スクリプトは `prisma generate && tsc -b` なので
  Prisma Client 生成も一緒に行われる
- 単独で `pnpm --filter @hatchery/common build` + `pnpm --filter @hatchery/server db:generate`
  と 2 ステップに分けることもできるが、Turborepo に委ねる方が一元管理できてシンプル

### ワークフロー修正方針

```
Install dependencies → Build dependencies (@hatchery/server とその依存) → Run community batch
```

## 5. 影響範囲

- `.github/workflows/run-batch.yml`（ステップ追加）
- `tests/run-batch-workflow.test.ts`（テスト追加）

## 6. テスト計画

`tests/run-batch-workflow.test.ts` に追記：

- ビルドステップが存在する（`pnpm turbo run build` を含む run ステップ）
- ビルドステップがバッチ実行ステップ（`batch` を含む run）より**前**にある
- `--filter` オプションで `@hatchery/server`（またはその依存を含む形）に絞られている

## 7. リスク・未決事項

- Turborepo の `--filter` で client ビルドまで走らないか: `--filter=@hatchery/server` は
  server とその依存（common）のみ対象で client は含まれない。問題なし。
- CI 時間増加: common のビルドは数秒程度でコスト影響は軽微。
