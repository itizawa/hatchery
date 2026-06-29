# 設計書: Cloud Run 本番環境のコールドスタートを定期 ping で解消する (#925)

## 1. 目的 / 背景

本番 Cloud Run（`hatchery-prod`）は `--min-instances=0` で運用しているため、
アイドル後（~15 分）にゼロスケールし、次リクエストでコールドスタートが発生してユーザー体験が悪化する。
`min-instances=1` はコスト（月 ~$5-10）が生じるため採用しない。
代わりに Cloud Scheduler から 10 分おきに `/api/health` を GET することでインスタンスをウォームに保つ。

## 2. スコープ（やること / やらないこと）

**やること**
- サーバに `/api/health` エンドポイントを追加（既存 `/health` は維持）
- `docs/deploy/setup.md` に Cloud Scheduler warmup ジョブの設定手順を追加
- `docs/adr/0011-server-hosting-cloud-run.md` を更新し定期 ping 採用を明記

**やらないこと**
- `min-instances` の変更（ADR-0011 の方針通り 0 を維持）
- 実際の GCP リソース作成（ドキュメント化のみ）

## 3. 受け入れ条件（テストに落とせる粒度）

1. `GET /api/health` が 200 と `{ status: "ok" }` を返す
2. `GET /health`（既存）が引き続き 200 と `{ status: "ok" }` を返す（リグレッション防止）
3. `docs/deploy/setup.md` に Cloud Scheduler `hatchery-prod-warmup` の設定手順が記載されている
   - スケジュール: `*/10 * * * *`、ターゲット: `https://hatchery-works.com/api/health`、リージョン: `asia-northeast1`
4. `docs/adr/0011-server-hosting-cloud-run.md` にコールドスタート対策の記述が追加されている
5. `pnpm turbo run build test lint` が緑

## 4. 設計方針

- `app.ts` で `healthRouter` を `/api/health` にも追加マウントする（最小変更）
- `createHealthRouter` 本体は変更不要（`/health` 向けと同一インスタンスを共有）
- OpenAPI 登録 (`registerHealth.ts`) に `/api/health` を追記し API ドキュメントに反映する

## 5. 影響範囲

- `server/src/app.ts`: `/api/health` ルート追加
- `server/src/openapi/registrations/registerHealth.ts`: `/api/health` パスを追加登録
- `server/src/routes/health.test.ts`: `GET /api/health` のテスト追加
- `docs/deploy/setup.md`: Cloud Scheduler セクション追加
- `docs/adr/0011-server-hosting-cloud-run.md`: コールドスタート対策の記述追加

## 6. テスト計画

- `server/src/routes/health.test.ts` に `GET /api/health` テスト追加:
  - 200 と `{ status: 'ok' }` を返すこと
  - 既存 `GET /health` テストもそのまま通ること（リグレッション）

## 7. リスク・未決事項

- Cloud Scheduler の実際の設定は人間側の GCP 操作が必要（本 PR はドキュメント化のみ）
- `/api/health` は認証不要の公開エンドポイントであること（OAuth 設定不要、既存 `/health` と同様）
