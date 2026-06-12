# 設計書: シーン生成バッチの起動基盤を Cloud Scheduler + Cloud Run Jobs へ移行する (#444)

## 1. 目的 / 背景

定時バッチ（シーン生成）は GitHub Actions の cron（`.github/workflows/run-batch.yml`）で 1 日 4 回起動しているが、以下の問題がある:

- **発火時刻が不正確**: GitHub Actions の schedule は負荷状況で数分〜数十分遅延しうる
- **毎回フルビルドが走る**: checkout → pnpm install → tsx 実行を毎回行うため遅く、ビルド起因の失敗リスクがある（#443 実績）
- **デプロイ成果物とのズレ**: develop の生ソースを実行するため Cloud Run にデプロイ済みの server イメージと実行物が一致しない

Cloud Scheduler + Cloud Run Jobs に移行することで、デプロイ済み Docker イメージでバッチを正確な時刻に実行できる。

## 2. スコープ（やること / やらないこと）

### やること
- ADR-0028 の追加
- Cloud Run Job + Cloud Scheduler の構成を gcloud コマンド手順書としてリポジトリに記録
- `run-batch.yml` の schedule トリガー削除（workflow_dispatch は保持）
- Dockerfile のバッチエントリ包含確認（既存で対応済み・ドキュメント明記）

### やらないこと
- アプリケーションロジックの変更
- 本番環境（main）の Cloud Scheduler 構成（dev 環境のみ）
- Batches API / プロンプトキャッシュ等のコスト削減（#389）
- Cloud Run Job の deploy-server-dev.yml への自動 update 組み込み（別 Issue）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `docs/adr/0028-cloud-scheduler-batch-execution.md` が追加されている
2. `docs/adr/README.md` に ADR-0028 の行が追加されている
3. `docs/cloud-run-batch-setup.md` に再現可能な gcloud コマンド手順書がある
4. `server/dist/batch/communityBatchIndex.js` が Docker イメージに含まれる（tsconfig 確認）
5. `.github/workflows/run-batch.yml` から schedule トリガーが削除されている（workflow_dispatch は残る）
6. `pnpm turbo run build test lint` が緑

## 4. 設計方針

### Dockerfile のバッチエントリ包含

現在の `server/tsconfig.json` は `include: ["src/**/*.ts"]` で `src/batch/communityBatchIndex.ts` をコンパイル対象に含む。`pnpm --filter @hatchery/server build`（`prisma generate && tsc -b`）で `server/dist/batch/communityBatchIndex.js` が生成され、`COPY --from=builder /app ./` でイメージに入る。

Dockerfile の変更は不要。ただし CMD の差し替え例をコメントとして明記する:
```
# Cloud Run Jobs でバッチ実行する場合:
# node server/dist/batch/communityBatchIndex.js
```

### Cloud Run Job の起動方式

server と同じ Docker イメージを使い、`--command` で CMD を上書き:
```
gcloud run jobs create hatchery-batch \
  --image=<server-image> \
  --command=node \
  --args="server/dist/batch/communityBatchIndex.js" \
  ...
```

### Secret Manager による環境変数注入

`DATABASE_URL` / `ANTHROPIC_API_KEY` を Secret Manager で管理し、Cloud Run Job に `--set-secrets` で注入。値をリポジトリ・workflow に直書きしない。

### Cloud Scheduler のトリガー

Cloud Scheduler から Cloud Run Jobs API を OIDC 認証で呼び出す:
- スケジュール: `0 0,3,6,9 * * *`（UTC・JST 9/12/15/18 時相当）
- タイムゾーン: UTC
- HTTP target: `https://<region>-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/<project>/jobs/<job-name>:run`

### run-batch.yml の schedule 削除

Cloud Scheduler に移行後は schedule トリガーが二重起動の原因になるため削除。緊急時の手動実行用に `workflow_dispatch` は残す。ただし手動実行は本来 `gcloud run jobs execute` で行う。

## 5. 影響範囲

- `docs/adr/0028-cloud-scheduler-batch-execution.md`（新規）
- `docs/adr/README.md`（更新）
- `docs/cloud-run-batch-setup.md`（新規）
- `.github/workflows/run-batch.yml`（schedule トリガー削除）
- アプリケーションコード変更なし

## 6. テスト計画

アプリケーションコード変更がないため、追加テストは不要。
- `pnpm turbo run build test lint` で既存テストが全て緑であることを確認

## 7. リスク・未決事項

- 受け入れ条件 #5「Cloud Run Job の手動実行で BatchRunLog にレコードが記録されること」はリモート実行環境から GCP にアクセスできないため、手順書に記載した期待結果を PR 本文に明記し、実際の実行確認は GCP アクセス権を持つ人間が行う必要がある
