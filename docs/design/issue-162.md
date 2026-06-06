# 設計書: server/Dockerfile の corepack enable が node:26-alpine の corepack 不在で失敗する (#162)

## 1. 目的 / 背景

`Deploy Server (dev)` の Docker build が `RUN corepack enable` で失敗する。実 CI（run 27045150054 / develop HEAD 4dec343）:

```
#7 [builder 2/12] RUN corepack enable
#7 0.159 /bin/sh: corepack: not found
#7 ERROR: process "/bin/sh -c corepack enable" did not complete successfully: exit code: 127
```

`server/Dockerfile` は pnpm 取得に `RUN corepack enable` を使う（builder 3 行目・本番 29 行目）が、**`node:26-alpine`（現行 digest sha256:144769…、CI と同一）は corepack を同梱しなくなった**（Node 25 以降 corepack は unbundled。実測: v26.3.0 / `which corepack` 無し / npm は有り）。以前 CI が通過していたのはレイヤキャッシュのヒットによるもので、エフェメラルランナーのクリーンビルドでは毎回 exit 127 で落ちる。#144（.dockerignore）修正後はブロッカーがこの corepack に前進している。

## 2. スコープ（やること / やらないこと）

### やること
- `server/Dockerfile` の `RUN corepack enable`（builder・本番の両ステージ）を、固定バージョンの pnpm をグローバル導入する形に置き換える。
- pnpm のバージョンはルート `package.json` の `packageManager`（現 `pnpm@10.34.1`）と一致させる。
- 回帰防止の規約テストを `tests/` に追加する。

### やらないこと
- pnpm のバージョン変更（`packageManager` 値の変更）。
- Dockerfile の他の構造（COPY 順・install/build コマンド・本番ステージ構成）の変更。
- base イメージの変更（`node:26-alpine` のまま）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `server/Dockerfile` が `corepack` に依存しない（`corepack` という語を含む RUN 命令が無い）。
2. `server/Dockerfile` の両ステージが pnpm をバージョン固定でグローバル導入する（`npm install -g pnpm@<version>`。`<version>` はルート `package.json` の `packageManager` の pnpm バージョンと一致）。
3. 回帰防止テスト: `server/Dockerfile` が「corepack enable を含まない」かつ「ルート `package.json` の `packageManager` と一致するバージョンの pnpm を `npm install -g` で導入する」ことを検証する。
4. `pnpm test:repo` / `pnpm lint` が緑。
5. （ローカル検証）`docker build -f server/Dockerfile .` が `corepack: not found`（exit 127）で失敗しない。

## 4. 設計方針

- `RUN corepack enable` を `RUN npm install -g pnpm@10.34.1` に置き換える。npm は `node:26-alpine` に同梱されているため確実に動く。バージョンは `packageManager: pnpm@10.34.1` を単一情報源とする。
  - builder ステージ（3 行目）: `RUN corepack enable` → `RUN npm install -g pnpm@10.34.1`
  - 本番ステージ（29 行目）: `RUN corepack enable && \ addgroup ...` → `RUN npm install -g pnpm@10.34.1 && \ addgroup ...`
- 回帰テストは `tests/dockerfile-pnpm.test.ts`（vitest, `test:repo`）。docker を起動せず、`server/Dockerfile` と root `package.json` を読み:
  - `corepack` を含む行が無いこと。
  - `npm install -g pnpm@<version>` が両ステージに存在し、`<version>` が `package.json` の `packageManager`（`pnpm@<version>`）から取り出したバージョンと一致すること。
  - これにより将来 `packageManager` を上げた際の不整合も検出できる（単一情報源の担保）。

## 5. 影響範囲 / 既存への変更

- `server/Dockerfile`（両ステージの pnpm 取得方法）
- `tests/dockerfile-pnpm.test.ts`（新規・回帰防止テスト）
- 対象ワークスペース: server（Docker ビルド）/ CI（server デプロイ）

## 6. テスト計画（TDD で書くテスト）

`tests/dockerfile-pnpm.test.ts`:
- `server/Dockerfile` に `corepack` を含む行が無い。
- `server/Dockerfile` に `npm install -g pnpm@<version>` が 2 回（両ステージ）現れる。
- その `<version>` が root `package.json` の `packageManager` のバージョンと一致する。

## 7. リスク・未決事項

- `npm install -g pnpm` はネットワーク取得を伴うが、`corepack enable`（同じくレジストリ取得）と同等で CI でも問題ない。
- 本修正後、Docker build → Cloud Run deploy まで到達する見込み（実到達はマージ後の develop push で確認。シークレットは設定済み）。
- pnpm バージョンは現状 `10.34.1`。`packageManager` を読んで単一情報源にすることで、将来のバージョン変更時もテストが整合を強制する。
