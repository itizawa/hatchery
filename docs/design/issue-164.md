# 設計書: server の Docker build を end-to-end で成功させる (#164)

## 1. 目的 / 背景

`server/Dockerfile` は一度も成功ビルドされておらず、バグが連鎖していた。① .dockerignore（#151）・② corepack（#162）は解消済み。残る ③ tsconfig COPY 漏れ・④ pnpm 構成の Prisma 生成物 path を解消し、`docker build -f server/Dockerfile .` が end-to-end で成功し、コンテナが Prisma Client / bcrypt をロードして起動できる状態にする。

実機検証で判明している事実:
- ③ builder が `tsconfig.base.json` を COPY せず `tsc -b` が TS5083 で失敗。
- ④ 本番ステージの `COPY --from=builder /app/node_modules/.prisma` が not found（pnpm は `.pnpm/` 配下に生成）。
- pnpm の `onlyBuiltDependencies` に `bcrypt`・`@prisma/engines` が無く、install 時に両者の build script がスキップされる（`Ignored build scripts: @prisma/engines@6.19.3, bcrypt@6.0.0`）。bcrypt はネイティブアドオン、Prisma はクエリエンジンが必要なため、これらが未ビルド/未取得だとランタイムで `require` 時に落ちる。

## 2. スコープ（やること / やらないこと）

### やること
- builder ステージが `tsc -b` の前にルート `tsconfig.base.json`（必要なら `tsconfig.json`）を COPY する（③）。
- 本番ステージで Prisma Client・クエリエンジン・bcrypt ネイティブが正しく利用可能になるよう Dockerfile を修正する（④）。**方針**: builder で全依存をビルド（generate + native build）し、本番ステージはその成果物を再利用する（壊れやすい個別 COPY / 再 generate を避ける）。
- ランタイムで native build / engine 取得が必要な `bcrypt`・`@prisma/engines` をルート `package.json` の `pnpm.onlyBuiltDependencies` に追加し、builder の install で確実にビルド/取得されるようにする。
- 回帰防止の静的テストを `tests/` に追加。

### やらないこと
- アプリのランタイムロジック変更。
- corepack（②）/ .dockerignore（①）の再修正。
- GCP / Cloud Run / シークレット設定（人間タスク・設定済み）。
- pnpm / Prisma のバージョン変更。

## 3. 受け入れ条件（テストに落とせる粒度）

1. builder ステージが `tsc -b`（`pnpm --filter @hatchery/server build`）の前にルート `tsconfig.base.json` を COPY する。
2. 本番ステージが、存在しない `/app/node_modules/.prisma` への COPY に依存しない（当該の壊れた COPY を削除し、生成物を正しく供給する）。
3. ルート `package.json` の `pnpm.onlyBuiltDependencies` に `bcrypt` と `@prisma/engines` が含まれる。
4. `docker build -f server/Dockerfile .` が最後まで成功する（ローカル実機。ログに `error TS` / `not found` / 非ゼロ exit なし）。
5. 生成イメージを起動したとき、`@prisma/client` と `bcrypt` のロードに失敗しない（必要 env をスタブして起動し、`Cannot find module` / `Query engine ... not found` / native binding エラーが出ないことをローカルで確認）。
6. `pnpm test:repo` / `pnpm lint` が緑。

## 4. 設計方針

### ③ tsconfig COPY
builder の `COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./` の直後に `COPY tsconfig.base.json tsconfig.json ./` を追加。`.dockerignore` は tsconfig を除外していないため COPY 可能。

### ④ Prisma / bcrypt（成果物再利用方式）
- `onlyBuiltDependencies` に `bcrypt`・`@prisma/engines` を追加 → builder の `pnpm install` で bcrypt ネイティブと Prisma エンジンが用意される。builder は `prisma generate` 済み。
- 本番ステージは「builder の `/app`（`node_modules`・workspace 構成・`dist`・`prisma`）を丸ごと COPY」して再利用する。これにより pnpm の `.pnpm` 仮想ストア（シンボリックリンク）・生成済み Prisma Client・ビルド済み bcrypt がそのまま入り、個別 COPY の path 不整合・再 generate の必要が無くなる。本番での `pnpm install --prod` と壊れた `.prisma` COPY は廃止。
- トレードオフ: dev/devDeps を含むためイメージは大きくなるが、dev 環境では許容（確実性を優先）。サイズ最適化は将来の別 Issue とする。

### 回帰テスト
`tests/dockerfile-build.test.ts`（vitest, `test:repo`）で静的検証:
- builder が `tsc -b` 前に `tsconfig.base.json` を COPY する。
- Dockerfile が `/app/node_modules/.prisma` への COPY を含まない（壊れた path の再混入防止）。
- root `package.json` の `onlyBuiltDependencies` に `bcrypt`・`@prisma/engines` が含まれる。
docker 実行を伴う end-to-end 検証はローカル手動で行い、PR にログ要約を残す。

## 5. 影響範囲 / 既存への変更

- `server/Dockerfile`（builder の tsconfig COPY / 本番ステージの再構成）
- `package.json`（`pnpm.onlyBuiltDependencies` に 2 件追加）
- `tests/dockerfile-build.test.ts`（新規）
- 対象ワークスペース: server（Docker）/ ルート（pnpm 設定）/ CI（server デプロイ）

## 6. テスト計画（TDD で書くテスト）

`tests/dockerfile-build.test.ts`:
- builder が `tsc -b` の前に `tsconfig.base.json` を COPY する（行順を検証）。
- Dockerfile に `node_modules/.prisma` という壊れた COPY が無い。
- `onlyBuiltDependencies` に `bcrypt` と `@prisma/engines` が含まれる。

## 7. リスク・未決事項

- 本番ステージで builder の node_modules を丸ごと使うためイメージが肥大化する（dev では許容。最適化は別 Issue）。
- `pnpm deploy` 方式は将来検討余地ありだが、Prisma 生成物の取り回しが不確実なため今回は成果物再利用方式を採る。
- 実機ビルド＆起動はローカルで反復検証する（CI の build-test-lint は docker を回さないため、PR CI 緑とは別にローカルで end-to-end を担保）。
