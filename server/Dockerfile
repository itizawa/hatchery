FROM node:26-alpine AS builder

RUN corepack enable

WORKDIR /app

# ワークスペース定義ファイルをコピー
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY common/package.json ./common/
COPY server/package.json ./server/

# server と依存する common のみインストール（client/docs は除外）
RUN pnpm install --frozen-lockfile --filter @hatchery/server...

# ソースコードをコピー
COPY common ./common
COPY server ./server

# prisma generate + tsc -b でビルド
RUN pnpm --filter @hatchery/server build

# --- 本番ステージ ---
FROM node:26-alpine

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY common/package.json ./common/
COPY server/package.json ./server/

# 本番依存のみインストール
RUN pnpm install --frozen-lockfile --filter @hatchery/server... --prod

# ビルド成果物と Prisma スキーマをコピー
COPY --from=builder /app/common/dist ./common/dist
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/prisma ./server/prisma

# Cloud Run は PORT 環境変数でポートを渡す（server/src/config/env.ts が参照）
EXPOSE 8080

# マイグレーション適用後にサーバを起動
CMD ["sh", "-c", "node server/dist/server.js"]
