# ADR-0011: サーバホスティング先（Cloud Run）と開発環境デプロイパイプライン

ステータス: Accepted
日付: 2026-06-04
関連 Issue: #78

---

## コンテキスト（背景）

Hatchery の `server`（Express 5 + Prisma）を**クラウドにデプロイして動く開発環境を用意**する必要がある。
client（Vite SPA）のホスティング先は ADR-0008 で **Cloudflare Pages** に決定済み。
server のホスティング先はまだ決まっておらず、本 ADR で決定する。

選定要件:

- **コンテナ対応**: monorepo 構成（pnpm workspaces）を Docker でビルドできること
- **PostgreSQL 接続**: `DATABASE_URL` を環境変数で渡せること（Neon 等の外部 DB を使う）
- **無料枠・低コスト**: 開発環境は小規模で十分。コールドスタート許容
- **GitHub Actions 連携**: `develop` push をトリガーに自動デプロイできること
- **認証の安全性**: サービスアカウントキーをリポジトリに置かない方式が望ましい

---

## 決定

**Google Cloud Run（asia-northeast1）を server のホスティング先として採用する。**

デプロイパイプライン:

- `develop` push → GitHub Actions → Docker build → Google Artifact Registry → Cloud Run deploy
- 認証: **Workload Identity Federation**（サービスアカウントキー不要）
- Dockerfile: Node 26-alpine の multi-stage ビルド（builder → runner）
- スケール: `--min-instances=0 --max-instances=3`（コールドスタート許容、コスト節約）
- ポート: Cloud Run が設定する `PORT` 環境変数を server がそのまま使用（デフォルト 8080）

client のデプロイは ADR-0008 の通り Cloudflare Pages を使用する。

---

## 理由

1. **コンテナ対応**: Cloud Run は任意の Docker コンテナを動かせる。pnpm monorepo の Dockerfile も自由に書ける。
2. **Workload Identity Federation**: GCP が GitHub Actions の OIDC トークンを直接検証するため、長命なサービスアカウントキーをリポジトリに置かずに済む（セキュリティ向上）。
3. **従量課金・無料枠**: リクエストがない時間はインスタンス 0 で課金されない。開発環境のコストを最小化できる。
4. **`DATABASE_URL` を環境変数で渡せる**: Prisma の接続先を Cloud Run の実行時環境変数として設定できる。
5. **Cloudflare Pages との親和性**: client（ADR-0008）が Cloudflare Pages、server が Cloud Run という組み合わせで、それぞれ最適なホスティングに分けられる。両者の連携は `CLIENT_ORIGIN`（CORS）と `VITE_API_BASE_URL` の環境変数設定で実現する。

---

## 検討した代替案

| 選択肢 | 概要 | 却下理由 |
|--------|------|---------|
| **Render.com** | PaaS。Dockerfile デプロイ対応。無料枠あり | GitHub Actions との連携がやや間接的。Workload Identity の仕組みが使えない |
| **Railway** | PaaS。monorepo 対応。PostgreSQL 内蔵オプションあり | 無料枠がなくなりつつある。Prisma Accelerate 等との連携が複雑になる可能性 |
| **Fly.io** | コンテナホスティング。低レイテンシ | アジアリージョン（東京）の選択肢が少ない。GCP に比べて GitHub Actions との統合実績が薄い |
| **Cloud SQL + App Engine** | GCP フルマネージド | App Engine は Dockerfile の自由度が低い。Cloud SQL は Neon より高コスト |

---

## コールドスタート対策（#925）

`--min-instances=0` のままコールドスタートによる初回レスポンス遅延を防ぐため、
**Cloud Scheduler から本番 Cloud Run の `/api/health` へ 10 分おきに GET ping を送る**。

- **スケジュール**: `*/10 * * * *`（Cloud Scheduler ジョブ名: `hatchery-prod-warmup`、リージョン: `asia-northeast1`）
- **ターゲット**: `https://hatchery-works.com/api/health`（Cloudflare Pages 経由でプロキシ）
- **コスト**: Cloud Scheduler は月 3 ジョブまで無料。追加コスト不要
- **根拠**: Cloud Run のアイドルタイムアウトデフォルト 15 分 > ping 間隔 10 分 のためゼロスケールを防止できる
- 設定手順は `docs/deploy/setup.md` §7 参照

---

## 影響（結果）

- **新規ファイル**: `server/Dockerfile`, `server/.dockerignore`, `.github/workflows/deploy-server-dev.yml`, `client/wrangler.toml`, `.github/workflows/deploy-client-dev.yml`, `docs/deploy/setup.md`
- **人間側の初期セットアップが必要**: GCP プロジェクト作成・Artifact Registry・Workload Identity Federation・GitHub Secrets の設定（`docs/deploy/setup.md` 参照）
- **`prisma migrate deploy` の実行**: デプロイ後、Cloud Run の初回起動前にマイグレーションを実行する必要がある。MVP では手動実行（`gcloud run jobs` または Cloud Shell から）を想定
- **ADR-0008 との整合**: client は Cloudflare Pages のまま変更なし。`VITE_API_BASE_URL` を Cloud Run の URL に向けることで client-server を繋ぐ

---

## 関連

- ADR-0008: Cloudflare Pages（client ホスティング）
- ADR-0004: server スタック（Express + Prisma）
- ADR-0002: ビルドツール（pnpm + Turborepo）
- Issue #78: 本 ADR に基づく実装
- Issue #925: コールドスタート対策（Cloud Scheduler 定期 ping）
