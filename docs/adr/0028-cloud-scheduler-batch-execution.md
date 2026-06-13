# ADR-0028: シーン生成バッチの起動基盤を Cloud Scheduler + Cloud Run Jobs へ移行する

- ステータス: Accepted
- 日付: 2026-06-12
- 関連 Issue: #444

## コンテキスト（背景）

シーン生成バッチは ADR-0009 の方針（Express とは別エントリポイントの単発スクリプトを外部スケジューラから起動）に従い、`.github/workflows/run-batch.yml` の GitHub Actions cron で 1 日 4 回（JST 9/12/15/18 時）起動している。

しかし以下の問題が顕在化している:

1. **発火時刻が不正確**: GitHub Actions の schedule は高負荷時に数分〜数十分遅延し、混雑時はスキップされうる（実績: JST 9:00 指定が 09:29〜09:34 発火）
2. **毎回フルビルドが走る**: checkout → pnpm install → tsx 実行を毎回行うため遅く、ビルド経路の問題（#443: common 未ビルドによる ERR_MODULE_NOT_FOUND）をバッチ実行が直接踏んだ
3. **デプロイ成果物とのズレ**: develop の生ソースを tsx で実行するため、Cloud Run にデプロイ済みの server Docker イメージと実行物が一致しない

server は ADR-0011 で Cloud Run + Workload Identity Federation にデプロイ済みであり、同じ GCP プロジェクト内で Cloud Scheduler → Cloud Run Jobs への移行によって、デプロイ済み Docker イメージでバッチを正確な時刻に実行できる。

## 決定

**Cloud Scheduler + Cloud Run Jobs を採用する。**

- server と同じ Docker イメージ（`server/dist/batch/communityBatchIndex.js` を含む）を Cloud Run Job として実行する
- スケジュール: `0 0,3,6,9 * * *`（UTC・JST 9/12/15/18 時）を Cloud Scheduler で管理する
- Cloud Scheduler は OIDC 認証で Cloud Run Jobs API を呼び出す
- `DATABASE_URL` / `ANTHROPIC_API_KEY` は GCP Secret Manager で管理し、Cloud Run Job に Secret 参照として注入する
- `.github/workflows/run-batch.yml` の schedule トリガーを削除し、二重起動を防ぐ（workflow_dispatch による緊急手動実行は残す）
- 初期セットアップ手順は `docs/cloud-run-batch-setup.md` に gcloud コマンドとして記録する

## 理由

| 観点 | GitHub Actions cron（移行前）| Cloud Scheduler + Cloud Run Jobs（採用）|
|------|------------------------------|----------------------------------------|
| 発火精度 | 遅延・スキップあり | 分単位で正確（SLA 99.9%）|
| ビルド | 毎回 pnpm install + tsx | ビルド済みイメージを再利用（ゼロビルド時間）|
| 実行物 | develop の生ソース | デプロイ済み Docker イメージ（一致保証）|
| 環境変数管理 | GitHub Actions Secrets | GCP Secret Manager（GCP 上で一元管理）|
| コスト | GitHub Actions 無料枠 | Cloud Scheduler 1 ジョブ（無料枠内）+ Cloud Run Jobs 実行時間課金（無視できる水準）|
| ADR-0009 整合 | 別エントリポイント維持 | 別エントリポイント維持（CMD 差し替えのみ）|

デプロイ済み Docker イメージでそのまま実行するため「デプロイ成果物と一致しない」問題が構造的に解消される。またビルド起因の失敗が根本的になくなる。

## 検討した代替案

- **GitHub Actions cron を継続**: ビルド経路の改善（#443 対応）で ERR_MODULE_NOT_FOUND は修正できるが、発火遅延・デプロイ成果物とのズレは根本解消されない。採用しない。

- **Cloud Scheduler → HTTP エンドポイント（Express API）**: server の HTTP エンドポイントにバッチ起動を仕込み、Cloud Scheduler から呼ぶ案。ADR-0009「バッチは Express とは別エントリポイントの単発スクリプト」という原則に反する（常時稼働プロセスが起動していることが前提になる）。Cloud Run がゼロインスタンスの場合にコールドスタート待ちが発生するリスクもある。採用しない。

## 影響（結果）

- **良い影響**:
  - バッチが JST 9/12/15/18 時に分単位で正確に起動する
  - デプロイ済みイメージを再利用するため、ビルド起因の失敗がなくなる
  - server と実行物が一致し、バッチ結果の再現性が向上する

- **トレードオフ / 注意点**:
  - Cloud Run Job と Cloud Scheduler の初期セットアップは手動で一度行う必要がある（手順書: `docs/cloud-run-batch-setup.md`）
  - server イメージを更新するたびに Cloud Run Job のイメージ参照も更新が必要（`gcloud run jobs update`。将来的に deploy-server-dev.yml への組み込みを検討）
  - workflow_dispatch による緊急手動実行は残るが、本来の手動実行手段は `gcloud run jobs execute` になる

- **フォローアップが必要なこと**:
  - Cloud Run Job のイメージ更新を deploy workflow に組み込む自動化（将来 Issue）
  - 本番環境（main）側の Cloud Scheduler 構成（main 昇格後に別途対応）
