# 開発環境デプロイ セットアップ手順

このドキュメントは、Hatchery の開発（dev）環境を初めてセットアップする際の手順を説明します。
セットアップ後は、`develop` ブランチへの push が自動的にデプロイをトリガーします（ADR-0011）。

## 事前準備チェックリスト

- [ ] Google Cloud アカウント（無料枠可）
- [ ] Cloudflare アカウント（無料枠可）
- [ ] GitHub リポジトリへの Admin 権限
- [ ] `gcloud` CLI のインストール（[公式ガイド](https://cloud.google.com/sdk/docs/install)）

---

## 1. Google Cloud 側の設定

### 1-1. プロジェクト作成・API 有効化

```bash
# プロジェクトを作成（hatchery-dev は任意の名前）
gcloud projects create hatchery-dev --name="Hatchery Dev"
gcloud config set project hatchery-dev

# 必要な API を有効化
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com
```

### 1-2. Artifact Registry リポジトリ作成

```bash
gcloud artifacts repositories create hatchery \
  --repository-format=docker \
  --location=asia-northeast1 \
  --description="Hatchery Docker images"
```

### 1-3. サービスアカウント作成・権限付与

```bash
SA_NAME="hatchery-github-actions"
PROJECT_ID=$(gcloud config get-value project)

gcloud iam service-accounts create $SA_NAME \
  --display-name="Hatchery GitHub Actions"

# 必要なロールを付与
for ROLE in \
  roles/run.admin \
  roles/artifactregistry.writer \
  roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="$ROLE"
done
```

### 1-4. Workload Identity Federation 設定

Workload Identity Federation を使うことで、サービスアカウントキーをリポジトリに置かずに GitHub Actions から GCP を操作できます。

```bash
# プールを作成
gcloud iam workload-identity-pools create "github-pool" \
  --location="global" \
  --display-name="GitHub Actions Pool"

# プロバイダを作成（YOUR_GITHUB_ORG/REPO を実際のものに変更）
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# サービスアカウントに権限を紐付け（YOUR_GITHUB_ORG/REPO を変更）
REPO="itizawa/ai-workspace"
gcloud iam service-accounts add-iam-policy-binding \
  "${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')/locations/global/workloadIdentityPools/github-pool/attribute.repository/${REPO}"

# Provider リソース名を取得（GitHub Secrets に設定する値）
gcloud iam workload-identity-pools providers describe github-provider \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --format="value(name)"
# → projects/XXXXXXX/locations/global/workloadIdentityPools/github-pool/providers/github-provider
```

### 1-5. PostgreSQL の準備

**Neon（推奨・無料枠あり）** を使う場合:
1. https://neon.tech にサインアップ
2. プロジェクト `hatchery-dev` を作成
3. Connection string を取得（`postgresql://user:pass@host/db?sslmode=require`）

**Cloud SQL** を使う場合:
```bash
gcloud sql instances create hatchery-dev-pg \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=asia-northeast1

gcloud sql databases create hatchery --instance=hatchery-dev-pg
gcloud sql users set-password postgres --instance=hatchery-dev-pg --password=YOUR_PASSWORD
```

### 1-6. データベースマイグレーションの実行

Cloud Run の初回デプロイ後、Cloud Shell から以下を実行してスキーマを適用します:

```bash
DATABASE_URL="postgresql://..." \
pnpm --filter @hatchery/server db:migrate
```

---

## 2. Cloudflare 側の設定

1. https://dash.cloudflare.com にログイン
2. **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
3. リポジトリ `itizawa/ai-workspace` を選択し、以下を設定:
   - **Production branch**: `main`
   - **Preview branches**: `develop`
   - **Build command**: *(GitHub Actions でビルドするため空白でよい)*
   - **Build output directory**: `client/dist/web`
4. **API Token** を取得:
   - My Profile → API Tokens → Create Token
   - テンプレート: **Edit Cloudflare Workers** を選択
5. **Account ID** を取得:
   - Cloudflare ダッシュボード右側のサイドバーに表示されている

---

## 3. GitHub Secrets の設定

リポジトリ Settings → Secrets and variables → Actions → **New repository secret** で以下を追加:

| Secret 名 | 値の取得元 | 説明 |
|-----------|-----------|------|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | 手順 1-4 の出力 | Workload Identity Provider リソース名 |
| `GCP_SA_EMAIL` | `${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com` | GitHub Actions 用 SA メール |
| `GCP_PROJECT_ID` | `gcloud config get-value project` | GCP プロジェクト ID |
| `GCP_REGION` | 例: `asia-northeast1` | Cloud Run のリージョン |
| `DATABASE_URL` | Neon または Cloud SQL の接続文字列 | Prisma 接続先 |
| `SESSION_SECRET` | 任意の 32 文字以上のランダム文字列 | Express session の署名鍵 |
| `ANTHROPIC_API_KEY` | Anthropic コンソール | AI バッチ用 |
| `CORS_ALLOWED_ORIGINS` | Cloudflare Pages の dev URL（例: `https://hatchery.pages.dev`） | CORS 許可オリジン（server の `CORS_ALLOWED_ORIGINS` 環境変数に対応） |
| `CLOUDFLARE_API_TOKEN` | 手順 2-4 で取得 | Wrangler デプロイ用 |
| `CLOUDFLARE_ACCOUNT_ID` | 手順 2-5 で取得 | Cloudflare アカウント識別子 |

> **セキュリティ注意**: `SESSION_SECRET` は `openssl rand -base64 32` で生成する。

また、**Repository Variables**（Secrets ではない通常の変数）として以下も設定します:

| Variable 名 | 値 | 説明 |
|------------|-----|------|
| `CLOUD_RUN_DEV_URL` | `https://hatchery-server-XXXXX-an.a.run.app` | Cloud Run のサービス URL |

Cloud Run の URL は初回デプロイ後に確定します。デプロイ後に GCP Console または `gcloud run services describe hatchery-server --region=asia-northeast1 --format='value(status.url)'` で取得してください。

---

## 4. 動作確認

1. `develop` ブランチに何かコミット・push する
2. GitHub Actions タブで `Deploy Server (dev)` と `Deploy Client (dev)` が緑になることを確認
3. Cloud Run のコンソールで表示される URL にアクセスして API が応答することを確認
4. Cloudflare Pages の URL（`https://develop.hatchery-XXXX.pages.dev`）にアクセス

---

## 関連

- ADR-0011: サーバホスティング選定の記録
- `.github/workflows/deploy-server-dev.yml`: サーバデプロイ用ワークフロー
- `.github/workflows/deploy-client-dev.yml`: クライアントデプロイ用ワークフロー
