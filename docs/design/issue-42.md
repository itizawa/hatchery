# 設計書: DB マイグレーション・初期化スクリプト実装（Prisma migrate + seed） (#42)

## 1. 目的 / 背景

server（Express + Prisma）の DB スキーマ変更を確実に反映する仕組み（migration）と、開発環境でのテストデータ自動投入（seed）を整備する。

現状を確認したところ:

- `server/prisma/migrations/` は **既に存在**し、初期 migration（`20260530112931_init`）以降、Scene 削除・User 追加・ChannelEmployee 追加の migration が積まれている（#6 / #27 / #26 / #33 で整備済み）。
- `server/prisma/seed.ts` は **テストユーザー 1 件のみ** を upsert する最小実装にとどまり、Issue #42 が要求する **DEFAULT_EMPLOYEES（3 人）/ DEFAULT_CHANNELS（2 件）の投入**、および **ワンコマンド初期化スクリプト（setup-db）** が未実装。
- `server/package.json` には `db:migrate`（`prisma migrate deploy`）/ `db:migrate:dev` / `db:seed` は既にあるが、migration + seed を一括実行する `setup-db` が無い。

本 Issue では「未実装の seed 内容」と「ワンコマンド初期化」を埋め、migration/seed の運用フローを完成させる。

## 2. スコープ（やること / やらないこと）

### やること

- `seed.ts` を **テスト可能な純粋オーケストレーション関数 `seedDevData(prisma)` に分離**し、common の `DEFAULT_EMPLOYEES` / `DEFAULT_CHANNELS` を単一情報源として Employee / Channel を upsert する。
- 本番環境（`NODE_ENV=production`）では seed をスキップする（関数内ガード）。
- `server/package.json` に `setup-db`（migration + seed の一括実行）スクリプトを追加する。
- seed オーケストレーションのユニットテスト（DB 非依存・fake prisma で upsert 呼び出しを検証）を追加する。
- README に「`.env.example` をコピーして `.env` を作成 →`setup-db`」の手順を追記する。

### やらないこと

- 既存 migration の作り直し（既に正しく積まれているため不要）。
- 本番 PostgreSQL（RDS 等）の構築・バックアップ戦略（Issue スコープ外）。
- 既存テストユーザーの id/password 変更（後述「設計判断」参照）。
- ChannelEmployee 所属・初期メッセージの投入は **任意項目**。dev データの有用性のため最小限の所属（全 Employee を両チャンネルに所属）のみ投入し、初期メッセージは投入しない。

## 3. 受け入れ条件（テストに落とせる粒度）

- AC1: `seedDevData(prisma)` は common の `DEFAULT_EMPLOYEES` 全 3 件を、それぞれ `id` をキーに `employee.upsert` で投入する。
- AC2: `seedDevData(prisma)` は common の `DEFAULT_CHANNELS` 全 2 件を、それぞれ `id` をキーに `channel.upsert` で投入する。
- AC3: `seedDevData(prisma)` はテストユーザー（`testuser` / `testpass`）を `user.upsert` で投入する。
- AC4: `NODE_ENV=production` のとき `seedDevData` は何も upsert せずスキップする（戻り値 `skipped: true`）。
- AC5: 各 Employee は両チャンネル（`DEFAULT_CHANNELS`）に `channelEmployee.upsert` で所属付けされる。
- AC6: `server/package.json` の scripts に `setup-db` が定義され、`prisma migrate dev` 系 + `prisma db seed` を一括実行する。
- AC7: 既存テスト（auth/channels 等が依存する `testuser` / `testpass`）が壊れない。
- AC8: `turbo run lint test build` が緑。

## 4. 設計方針

- **責務分離**: `seed.ts` を 2 層に分ける。
  - `seedDevData.ts`: prisma クライアントの **構造的インターフェース**（`SeedPrisma`）を引数に取り、upsert を発行する純粋オーケストレーション。`@prisma/client` の **値 import を行わない**（`import type` のみ）。これにより、生成済み Prisma Client や実 DB が無くてもユニットテスト可能。bcrypt のみ実行時依存。
  - `seed.ts`: CLI エントリ。`new PrismaClient()` を生成し `seedDevData` を呼び、`$disconnect`。`prisma.seed`（package.json）から起動される既存の口を維持。
- **単一情報源**: 投入データは common（`@hatchery/common`）の `DEFAULT_EMPLOYEES` / `DEFAULT_CHANNELS` を import（ADR-0005 / 一方向依存 server→common を遵守）。
- **冪等性**: 全て `upsert`（`where: { id }`, `update: {}`, `create: {...}`）で再実行安全。
- **本番ガード**: `seedDevData` 冒頭で `NODE_ENV==='production'` ならスキップ。

### 設計判断: テストユーザーの id/password

Issue 本文の例では `dev-user` / `password` とあるが、既存コードベースは `testuser` / `testpass` で標準化済み（`seed.ts` 旧実装・`userRepository.withTestUser()`・`auth.test.ts`・`channels.test.ts` が全てこれに依存）。id を変更すると既存実装との一貫性が崩れ AC7 に反するため、**`testuser` / `testpass` を維持**する。AC の意図「dev 用テストユーザーが seed に存在する」は満たされる。

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: **server**（+ README）。common は読み取りのみ（変更なし）。
- 変更: `server/prisma/seed.ts`（CLI 化）、新規 `server/prisma/seedDevData.ts`、新規 `server/prisma/seedDevData.test.ts`、`server/package.json`（`setup-db` 追加）、`README.md`（手順追記）。

## 6. テスト計画（TDD）

`server/prisma/seedDevData.test.ts`（DB 非依存・fake prisma）:

1. AC3: `testuser` が `user.upsert` で投入される（id・displayName 検証）。
2. AC1: `DEFAULT_EMPLOYEES` 全件が `employee.upsert` で投入される（id 集合一致）。
3. AC2: `DEFAULT_CHANNELS` 全件が `channel.upsert` で投入される（id 集合一致）。
4. AC5: 各 Employee × 各 Channel の所属が `channelEmployee.upsert` で投入される（件数 = 社員数 × チャンネル数）。
5. AC4: `NODE_ENV=production` で全 upsert が呼ばれずスキップされる。

## 7. リスク・未決事項

- seed の実 DB 投入は統合テスト相当（要 DATABASE_URL）で、CI には DB が無いためユニットテスト（fake prisma）で振る舞いを担保する。実 DB での疎通は dev 環境（#78）整備後に確認。
- `setup-db` は `prisma migrate dev` を含むため対話が出る可能性があり、`--skip-generate` + 非対話前提（既存 migration 適用のみ）で構成する。
