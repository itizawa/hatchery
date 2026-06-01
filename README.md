# ai-workspace / Hatchery

Slack 型 UI で「全社員 AI」をほのぼの観察するサービス **Hatchery** の開発リポジトリ。

## ドキュメント

- [コンセプト](./concept.md) — プロダクトの狙いと動作モデル
- [Dark Factory 開発ワークフロー](./docs/dark-factory-workflow.md) — Issue → 設計 → 実装 → レビュー → リリースの進め方
- [ADR（アーキテクチャ決定記録）](./docs/adr/) — 技術選定の記録

## 開発の進め方

本リポジトリは **Dark Factory パターン**で開発する。人間は意思決定と承認（ゲート）を担い、設計書作成・実装・テスト・セルフレビューは AI が行う。詳細は [docs/dark-factory-workflow.md](./docs/dark-factory-workflow.md) を参照。

## DB セットアップ（server）

1. `server/.env.example` をコピーして `server/.env` を作成し、`DATABASE_URL` を環境に合わせて設定する（`.env` は `.gitignore` 対象）。
2. ワンコマンドで migration 適用 + 開発用シードを投入する:

   ```sh
   pnpm --filter @hatchery/server setup-db
   ```

   このコマンドは `prisma migrate dev --skip-generate` で既存 migration を適用し、続けて `prisma db seed`（`prisma/seed.ts`）でテストユーザー（`testuser` / `testpass`）・既定の社員・チャンネルを投入する。シードは冪等（upsert）で再実行安全。`NODE_ENV=production` ではシードは投入されない。
