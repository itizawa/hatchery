FROM node:26-alpine AS builder

# node:26-alpine は pnpm 管理ツールを同梱しないため、pnpm を npm でバージョン固定導入する（#162）。
# バージョンはルート package.json の packageManager と一致させる。
RUN npm install -g pnpm@10.34.1

WORKDIR /app

# ワークスペース定義ファイルをコピー
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
# 各ワークスペースの tsconfig は ../tsconfig.base.json を extends するため、ビルド前に必須（#164）。
COPY tsconfig.base.json tsconfig.json ./
COPY common/package.json ./common/
COPY server/package.json ./server/
# pnpm-workspace.yaml に列挙された全ワークスペースの package.json が必要
# （client/docs はインストール対象外だがワークスペース解決に必要）
COPY client/package.json ./client/
COPY docs/package.json ./docs/

# server と依存する common のみインストール（client/docs は除外）。
# ルート package.json の onlyBuiltDependencies により bcrypt（ネイティブ）と
# @prisma/engines（クエリエンジン取得）の build script もここで実行される（#164）。
RUN pnpm install --frozen-lockfile --filter @hatchery/server...

# ソースコードをコピー
COPY common ./common
COPY server ./server

# prisma generate + tsc -b でビルド
RUN pnpm --filter @hatchery/server build

# --- 本番ステージ ---
FROM node:26-alpine

RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

# builder の成果物を丸ごと再利用する（#164）。
# 依存ツリーには生成済み Prisma Client・ビルド済み bcrypt・取得済みクエリエンジンが含まれ、
# pnpm の .pnpm 仮想ストア（シンボリックリンク）も保たれるため、生成物の個別 COPY の path 不整合や
# 本番での再 generate が不要になる。
COPY --from=builder /app ./

RUN chown -R app:app /app

USER app

# Cloud Run は PORT 環境変数でポートを渡す（server/src/config/env.ts が参照）
EXPOSE 8080

CMD ["node", "server/dist/server.js"]
