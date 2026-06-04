FROM node:26-alpine AS builder

RUN corepack enable

WORKDIR /app

# ワークスペース定義ファイルをコピー
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY common/package.json ./common/
COPY server/package.json ./server/
# pnpm-workspace.yaml に列挙された全ワークスペースの package.json が必要
# （client/docs はインストール対象外だがワークスペース解決に必要）
COPY client/package.json ./client/
COPY docs/package.json ./docs/

# server と依存する common のみインストール（client/docs は除外）
RUN pnpm install --frozen-lockfile --filter @hatchery/server...

# ソースコードをコピー
COPY common ./common
COPY server ./server

# prisma generate + tsc -b でビルド
RUN pnpm --filter @hatchery/server build

# --- 本番ステージ ---
FROM node:26-alpine

RUN corepack enable && \
    addgroup -S app && adduser -S app -G app

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY common/package.json ./common/
COPY server/package.json ./server/
COPY client/package.json ./client/
COPY docs/package.json ./docs/

# 本番依存のみインストール
RUN pnpm install --frozen-lockfile --filter @hatchery/server... --prod

# ビルド成果物と Prisma スキーマをコピー
COPY --from=builder /app/common/dist ./common/dist
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/prisma ./server/prisma
# prisma generate で生成されたエンジンファイルをコピー（本番ステージでは prisma CLI を使わないため）
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

RUN chown -R app:app /app

USER app

# Cloud Run は PORT 環境変数でポートを渡す（server/src/config/env.ts が参照）
EXPOSE 8080

CMD ["node", "server/dist/server.js"]
