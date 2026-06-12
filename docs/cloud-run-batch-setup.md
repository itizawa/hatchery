# Cloud Run Jobs + Cloud Scheduler バッチ起動基盤 セットアップ手順

シーン生成バッチを GitHub Actions cron から Cloud Scheduler + Cloud Run Jobs へ移行するための
一時的なセットアップ手順書。ADR-0028 の決定に基づく。

## 前提条件

- `gcloud` CLI がインストール済み
- GCP プロジェクトへの編集権限を持つアカウントでログイン済み
- `deploy-server-dev.yml` が develop ブランチへの push をトリガーに server イメージをビルド・push 済みであること
- Cloud Run サービス（`hatchery`）が GCP プロジェクトに存在すること（ADR-0011）

## 変数の準備

```bash
export PROJECT_ID="<your-gcp-project-id>"
export REGION="<your-region>"   # 例: asia-northeast1
export IMAGE_REPO="${REGION}-docker.pkg.dev/${PROJECT_ID}/hatchery/server"
# 最新デプロイ済みイメージを確認する
export IMAGE=$(gcloud run services describe hatchery \
  --region=${REGION} --format='value(spec.template.spec.containers[0].image)')
export JOB_NAME="hatchery-batch"
# Cloud Run サービスと同じサービスアカウントを使用
export SA_EMAIL=$(gcloud run services describe hatchery \
  --region=${REGION} --format='value(spec.template.spec.serviceAccountName)')
```

## ステップ 1: Secret Manager にシークレットを作成する（初回のみ）

```bash
# DATABASE_URL を登録
echo -n "<DATABASE_URL>" | gcloud secrets create hatchery-database-url \
  --data-file=- --project=${PROJECT_ID}

# ANTHROPIC_API_KEY を登録
echo -n "<ANTHROPIC_API_KEY>" | gcloud secrets create hatchery-anthropic-api-key \
  --data-file=- --project=${PROJECT_ID}
```

既に登録済みの場合は新しいバージョンを追加:

```bash
echo -n "<NEW_VALUE>" | gcloud secrets versions add hatchery-database-url \
  --data-file=- --project=${PROJECT_ID}
```

## ステップ 2: サービスアカウントに必要な権限を付与（初回のみ）

Secret Manager の読み取り権限と、Cloud Scheduler が Cloud Run Job を起動するための `roles/run.invoker` 権限を付与する。

```bash
# Secret Manager の読み取り権限
gcloud secrets add-iam-policy-binding hatchery-database-url \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" \
  --project=${PROJECT_ID}

gcloud secrets add-iam-policy-binding hatchery-anthropic-api-key \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" \
  --project=${PROJECT_ID}
```

Cloud Run Job の実行権限（Cloud Scheduler が Job を起動するために必要）:

```bash
gcloud run jobs add-iam-policy-binding ${JOB_NAME} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.invoker" \
  --region=${REGION} \
  --project=${PROJECT_ID}
```

## ステップ 3: Cloud Run Job を作成する（初回のみ）

バッチは server と同じ Docker イメージを使い、`--command` で `CMD` を差し替えて実行する。
`server/dist/batch/communityBatchIndex.js` は `tsc -b` で生成され、サーバイメージに含まれている
（`server/tsconfig.json` の `include: ["src/**/*.ts"]` でバッチソースもコンパイル対象）。

```bash
gcloud run jobs create ${JOB_NAME} \
  --image=${IMAGE} \
  --command=node \
  --args="server/dist/batch/communityBatchIndex.js" \
  --region=${REGION} \
  --project=${PROJECT_ID} \
  --service-account=${SA_EMAIL} \
  --set-secrets="DATABASE_URL=hatchery-database-url:latest,ANTHROPIC_API_KEY=hatchery-anthropic-api-key:latest" \
  --max-retries=1 \
  --task-timeout=600 \
  --memory=512Mi \
  --cpu=1
```

## ステップ 4: Cloud Scheduler ジョブを作成する（初回のみ）

Cloud Scheduler が Cloud Run Jobs API を OIDC 認証で呼び出す。
スケジュール: UTC 0/3/6/9 時（= JST 9/12/15/18 時）。

Cloud Run Jobs execution endpoint はリクエストに OIDC id_token を要求する（OAuth アクセストークンは不可）。
また URI の `namespaces/` セグメントは**数値のプロジェクト番号**が必要（文字列プロジェクト ID は不可）。

```bash
# プロジェクト番号を取得する（一度だけ実行）
export PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')

gcloud scheduler jobs create http ${JOB_NAME}-schedule \
  --schedule="0 0,3,6,9 * * *" \
  --time-zone="UTC" \
  --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_NUMBER}/jobs/${JOB_NAME}:run" \
  --message-body="{}" \
  --headers="Content-Type=application/json" \
  --oidc-service-account-email=${SA_EMAIL} \
  --oidc-token-audience="https://${REGION}-run.googleapis.com/" \
  --location=${REGION} \
  --project=${PROJECT_ID}
```

## ステップ 5: 手動実行して動作確認する

```bash
gcloud run jobs execute ${JOB_NAME} \
  --region=${REGION} \
  --project=${PROJECT_ID} \
  --wait
```

正常に完了した場合、`BatchRunLog` テーブルに実行記録が挿入される。
確認方法（psql / Prisma Studio 等）:

```sql
SELECT * FROM "BatchRunLog" ORDER BY "startedAt" DESC LIMIT 1;
```

## サーバイメージ更新後のジョブ更新

`deploy-server-dev.yml` で新しいイメージが push されるたびに、Cloud Run Job が使用するイメージも
更新する必要がある。現在は手動で行う（将来的に deploy workflow への組み込みを検討、ADR-0028）:

```bash
# 最新イメージを取得
NEW_IMAGE=$(gcloud run services describe hatchery \
  --region=${REGION} --format='value(spec.template.spec.containers[0].image)')

# Cloud Run Job のイメージを更新
gcloud run jobs update ${JOB_NAME} \
  --image=${NEW_IMAGE} \
  --region=${REGION} \
  --project=${PROJECT_ID}
```

## トラブルシューティング

### ジョブ実行ログを確認する

```bash
gcloud logging read \
  "resource.type=cloud_run_job AND resource.labels.job_name=${JOB_NAME}" \
  --limit=50 \
  --project=${PROJECT_ID} \
  --format="value(timestamp,textPayload)"
```

### 失敗したジョブ実行を確認する

```bash
gcloud run jobs executions list \
  --job=${JOB_NAME} \
  --region=${REGION} \
  --project=${PROJECT_ID}
```

### Secret Manager の権限エラーが出る場合

```bash
# サービスアカウントの権限を確認
gcloud secrets get-iam-policy hatchery-database-url --project=${PROJECT_ID}
```
