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

# 本番依存のみの自己完結ツリーを /prod に生成する（#172）。
# --prod で devDependencies（tsx / prisma CLI / supertest 等）を除外し、
# workspace 依存（@hatchery/common）は実体注入される。--legacy で
# 仮想ストアではなく実体の node_modules を持つツリーを作る。
# （bcrypt は #455 の Google-only auth 移行で廃止済みのため本番依存に含まれない。
#  onlyBuiltDependencies に残るのは @prisma/engines 等で、Prisma 成果物は次段で供給する。）
RUN pnpm --filter @hatchery/server deploy --prod --legacy /prod

# pnpm deploy は本番依存を新規 install するため、builder で `prisma generate` 済みの
# Prisma Client（生成コード + クエリエンジン）は /prod には入らない。prisma CLI は
# devDependency のため /prod 側で再 generate もできない。そこで builder の pnpm 仮想ストア内に
# 生成済みの Prisma 生成ディレクトリ（`.pnpm/@prisma+client@<hash>/node_modules/<gen>`、
# <gen> はドット prisma ディレクトリ）を、/prod の同一 `@prisma/client` パッケージ配下へ複製する。
# deploy は同一 lockfile から同一 hash の `.pnpm` ディレクトリを作るため path は安定し、
# `@prisma/client` の symlink がこれを解決してランタイムで Prisma Client / クエリエンジンを読み込める。
RUN set -eux; \
    gen=".prisma"; \
    src="$(find /app/node_modules/.pnpm -maxdepth 4 -type d -path "*/@prisma+client@*/node_modules/$gen" | head -n1)"; \
    dst_parent="$(find /prod/node_modules/.pnpm -maxdepth 3 -type d -path '*/@prisma+client@*/node_modules' | head -n1)"; \
    test -n "$src"; test -n "$dst_parent"; \
    cp -R "$src" "$dst_parent/$gen"; \
    test -d "$dst_parent/$gen/client"; \
    ls "$dst_parent/$gen/client"/libquery_engine-*.so.node

# prisma CLI（generate / migrate 用）はランタイム不要。@prisma/client が peer 依存として
# /prod の pnpm 仮想ストアに引き込む（約 50MB）が、生成済み Client + クエリエンジンは上で
# 供給済みのため安全に削除できる。本番イメージの依存ツリーから prisma CLI を除く（#172 AC#3）。
RUN set -eux; \
    rm -rf /prod/node_modules/.pnpm/prisma@* /prod/node_modules/prisma; \
    cd /prod && node -e "new (require('@prisma/client').PrismaClient)(); console.log('prisma client loads without CLI')"

# --- 本番ステージ ---
FROM node:26-alpine

RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

# 本番依存 + ランタイム成果物のみの自己完結ツリーだけを持ち込む（#172）。
# devDependencies・全ワークスペースのソース・ビルドキャッシュ・pnpm 仮想ストアは含めない。
# /prod には server/dist（ビルド成果物）・prisma（スキーマ）・本番 node_modules
# （生成済み Prisma Client / クエリエンジン / ビルド済み bcrypt）が含まれる。
COPY --from=builder /prod ./

RUN chown -R app:app /app

USER app

# Cloud Run は PORT 環境変数でポートを渡す（server/src/config/env.ts が参照）
EXPOSE 8080

CMD ["node", "dist/server.js"]
