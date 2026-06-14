# Issue #509 設計書: CI で PostgreSQL を起動し統合テストを実行 + CI 限定 DB 高速化チューニング

## 背景・目的

現状の `.github/workflows/ci.yml` には `DATABASE_URL` が無く、Prisma を使う統合テスト
（`server/src/persistence/*.test.ts` 内の `describe.skipIf(!DATABASE_URL)` ブロック）は CI 上で
**まるごとスキップ**されている。本 Issue では:

1. CI 上で PostgreSQL を `services:` コンテナとして起動し `DATABASE_URL` を注入する。
2. テスト前に Prisma マイグレーション（`pnpm --filter @hatchery/server db:migrate`）を適用する。
3. これまでスキップされていた統合テストを CI で**実際に実行して緑**にする。
4. 記事(3) に倣い **CI 限定の PostgreSQL 高速化チューニング**（耐久性を犠牲に速度優先）を適用する。

## 用語整理（Issue 本文と実装の対応）

Issue 本文は `*.int.test.ts` という命名を想定しているが、本リポジトリの実際の統合テストは
`server/src/persistence/prisma*Repository.test.ts` 等の `*.test.ts` 内で
`const DATABASE_URL = process.env.DATABASE_URL;` を読み `describe.skipIf(!DATABASE_URL)(...)`
でゲートする方式である（8 ファイル）。本 Issue では**この既存方式の統合テスト**を対象とする
（受け入れ条件 #3 の「`*.int.test.ts`」はこの `skipIf(!DATABASE_URL)` 統合テストと読み替える）。
新たに命名規約を変えると差分が広がり #507 等とのコンフリクトリスクが上がるため、命名は変更しない。

## 受け入れ条件 → 設計判断

### AC1: PostgreSQL を `services:` で起動し `DATABASE_URL` を注入

- `build-test-lint` job に `services.postgres` を追加。イメージは **`postgres:16`**
  （本番 Cloud SQL は `POSTGRES_16`・develop/stg の Neon も PG16 系で整合。`docs/deploy/setup.md`
  の `--database-version=POSTGRES_16` に合わせる）。
- `POSTGRES_USER=hatchery` / `POSTGRES_PASSWORD=hatchery` / `POSTGRES_DB=hatchery_test`、
  ポート `5432:5432` を公開。`pg_isready` の `--health-cmd` でヘルスチェックし、
  起動完了を待ってからステップを進める。
- job 全体の `env.DATABASE_URL` に
  `postgresql://hatchery:hatchery@localhost:5432/hatchery_test?schema=public` を設定。
  これにより既存の `skipIf(!DATABASE_URL)` が無効化され、統合テストが走る。

### AC2: テスト前に Prisma マイグレーション適用

- `Lint / Test / Build`（= `turbo run ... test`）ステップの**前**に
  `Run Prisma migration (CI)` ステップを追加し `pnpm --filter @hatchery/server db:migrate`
  （= `prisma migrate deploy`）を実行。`deploy-server-dev.yml` の同名ステップが雛形。
- `prisma generate` は `@hatchery/server#build` の依存で turbo が走らせるが、`migrate deploy`
  は generate 不要のため順序問題は無い。マイグレーション適用後にスキーマが整った状態で
  `turbo test`（server の vitest）と `Test with coverage (server)` が実行される。

### AC3: スキップ 0 で統合テストが緑

- `DATABASE_URL` が注入されることで 8 ファイルの `skipIf` が解除され実行される。
- `vitest.config.ts` は `fileParallelism: false`（直列実行）なので、複数の統合テストファイルが
  単一 DB を共有しても**ファイル間で同時書き込みが起きない**。各ファイルは `afterEach` で
  対象テーブルを `deleteMany` してクリーンアップ済み（AC5 参照）。
- **turbo strict env mode の落とし穴**: turbo 2.x は strict env mode のため、`turbo.json` の
  タスクに宣言されていない env var はタスクの `process.env` から除外される。`DATABASE_URL` を
  job env に入れるだけでは `@hatchery/server#test`（turbo 経由）に渡らず、統合テストが
  `skipIf(!DATABASE_URL)` で**サイレントにスキップ**されてしまう（CI は緑のまま AC3 違反）。
  そのため `turbo.json` の `@hatchery/server#test` に `"env": ["DATABASE_URL"]` を宣言し、
  値変化でキャッシュも適切にバストされるようにする。`tests/ci-integration-db.test.ts` で
  この宣言の存在を回帰テストとしてガードする。

### AC4: CI 限定の耐久性無効チューニング

- `services.postgres.options` で起動時に渡せないため（公式 postgres イメージの引数は `command`
  で渡すが GitHub Actions の `services` は `command` 上書き不可）、**起動後に `ALTER SYSTEM` で
  適用**する専用ステップ `Apply CI-only PostgreSQL durability-off tuning` を追加し、`psql` で
  以下を設定して `pg_ctl reload` 相当（`SELECT pg_reload_conf()`）する:
  - `fsync=off`
  - `synchronous_commit=off`
  - `full_page_writes=off`
- これらは**本番では禁止**（クラッシュ時にデータ破損し得る）だが、CI は使い捨て DB のため許容。
  ステップ名・コメント・本設計書で **CI 専用**である旨を明示する。
- `fsync` / `full_page_writes` は `pg_reload_conf` では即時反映されないパラメータ
  （`postmaster` コンテキスト）だが、`synchronous_commit` は反映される。確実に全設定を効かせる
  ため、`ALTER SYSTEM` 後に **`services` コンテナを再起動せず**、効果が確実な
  `synchronous_commit=off`（commit ごとの fsync 待ちを無くす最大の効きどころ）を主軸とし、
  `fsync` / `full_page_writes` は `ALTER SYSTEM` で永続化しつつ best-effort とする。
  → 設計の単純化と確実性のため、**`docker exec` でコンテナの `command` を差し替えるのではなく
  `ALTER SYSTEM` + reload** とする。`synchronous_commit=off` が CI のテスト DB I/O では最も効く。

### AC5: テスト間の DB 分離

- 既存統合テストは各々 `afterEach`（または `beforeEach`）で対象テーブルを `deleteMany` して
  分離済み。`fileParallelism: false` でファイル間も直列。**新たな分離機構は追加しない**
  （既存方式に合わせる、という受け入れ条件の指示どおり）。

### AC6: CI 限定チューニングが本番に漏れない

- 変更は `.github/workflows/ci.yml` のみ。`deploy-server-dev.yml` / `deploy-server-prod.yml` /
  `server` の本番 DB 接続コード（`prisma/schema.prisma`・`env.ts`）は**一切変更しない**。
- チューニングは CI job の `services` コンテナ + CI job 内ステップに閉じる。

### AC7: build/test/lint が緑

- `pnpm turbo run lint test build` および CI 全体（統合テスト含む）が緑になることを CI で確認。

## 統合テストを CI で初めて実行して判明した既存不具合（AC3 で顕在化）

統合テストはこれまで CI で常にスキップされていたため、以下の**既存の不整合**が隠れていた。
本 Issue で CI 実行を有効化した結果として顕在化したため、AC3（スキップ 0 で緑）を満たすべく
同 PR で修正する。

1. **`TokenUsageLog` の migration 欠落**: `schema.prisma` に `TokenUsageLog` モデルが存在するが
   対応する migration が無く、`prisma migrate deploy` 後もテーブルが作られていなかった
   （`prismaTokenUsageLogRepository.test.ts` が `relation does not exist` で失敗）。
   → `server/prisma/migrations/20260614120000_add_token_usage_log/migration.sql` を追加。
   `prisma migrate diff`（実 DB → schema）で生成した CreateTable + index のみを採用し、
   ランタイム作成の `session` テーブル DROP や uuid デフォルト差分のノイズは含めない。
2. **`prismaSubscriptionRepository.test.ts` の stale fixture**: `user.create` が #455 で削除済みの
   `loginId` を渡しており（必須の `email` / `googleId` を欠く）Prisma バリデーションで失敗。
   → 他の統合テスト（`prismaVoteRepository.test.ts`）と同じ `email` / `googleId` 形式に修正。
   既存 stale テストの fixture 補修であり、本 Issue で新規に書いたテストは変更していない。

## 変更ファイル

- `.github/workflows/ci.yml`（services.postgres 追加 / env.DATABASE_URL / 耐久性 off チューニング /
  migrate ステップ）
- `turbo.json`（`@hatchery/server#test` に `env: ["DATABASE_URL"]` を宣言し strict env mode で
  統合テストへ DATABASE_URL を渡す）
- `server/prisma/migrations/20260614120000_add_token_usage_log/migration.sql`（欠落 migration 補完）
- `server/src/persistence/prismaSubscriptionRepository.test.ts`（stale fixture 修正）
- `tests/ci-integration-db.test.ts`（CI 構造の規約テスト）
- `docs/design/issue-509.md`（本ファイル）

## テスト方針（TDD）

CI workflow 自体はユニットテストの対象にしづらいため、**`ci.yml` の構造的要件**を検証する
リポジトリ規約テストを `tests/`（`pnpm test:repo`）に追加する:

1. `ci.yml` に `services:` で `postgres:16` が定義されている。
2. job に `DATABASE_URL` 環境変数が定義されている。
3. `db:migrate` を実行するステップが存在する。
4. CI 限定チューニング（`synchronous_commit=off` / `fsync=off` / `full_page_writes=off`）が
   `ci.yml` に含まれる。
5. **本番 deploy workflow（`deploy-server-dev.yml` / `deploy-server-prod.yml`）に
   耐久性無効チューニングが漏れ出していない**（AC6 のガード）。

まずこのテストを書いて失敗を確認 → `ci.yml` を実装して緑にする。実際の統合テスト実行は
GitHub Actions 上で `skipIf` が解除され緑になることで確認する（CI ログでスキップ 0 を確認）。

## スコープ外

- 記事(2) のマイグレーション済みデータディレクトリキャッシュ（PG では構成が重く別途検討）。
- Turborepo Remote Caching（#508）。
