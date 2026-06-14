# 設計書: server 本番 Docker イメージのサイズ最適化（本番依存のみに絞る）(#172)

## 1. 目的 / 背景

#164 で `server/Dockerfile` の end-to-end ビルドを成功させる際、確実性を優先して**本番ステージが builder の `/app` を丸ごと再利用する**方式（`COPY --from=builder /app ./`）を採った。これにより pnpm の `.pnpm` 仮想ストア・生成済み Prisma Client・ビルド済み bcrypt がそのまま入り、生成物の個別 COPY の path 不整合や本番での再 generate を避けられた一方、**本番イメージに devDependencies（tsx / prisma CLI / supertest / esbuild 等）・全ワークスペースのソース・ビルドキャッシュまで含まれ、イメージサイズが大きい**。

Cloud Run のコールドスタート・転送時間・コストの観点で、本番イメージを**ランタイムに必要な最小構成**に絞る。ただし #164 で達成した「end-to-end でビルドが通り、コンテナが Prisma Client をロードして起動できる」状態は維持する（リグレッションさせない）。なお Issue は bcrypt も挙げるが、#455 の Google-only auth 移行で bcrypt は廃止済みのため対象外（§4 末尾参照）。

## 2. スコープ（やること / やらないこと）

### やること

- 本番ステージを「本番依存 + ランタイム成果物のみ」に絞り、devDependencies・ソース・ビルドキャッシュを含めない。
- Prisma クエリエンジン・生成済み Prisma Client がランタイムに存在することを実機起動で確認する。
- 回帰防止の静的テストを `tests/` に追加。

### やらないこと

- アプリのランタイムロジック変更。
- corepack / .dockerignore / tsconfig の再修正（#164 で解決済み）。
- マルチアーキ対応・レイヤキャッシュ最適化などサイズ削減以外の最適化。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `docker build -f server/Dockerfile .` が end-to-end で成功する（ローカル実機）。
2. 生成イメージのコンテナを起動したとき、`@prisma/client` のロードに失敗せず `node dist/server.js` が起動する（`Cannot find module` / `Query engine ... not found` エラーが出ない）。bcrypt は #455 で廃止済みのため対象外。
3. 本番イメージが devDependencies（`tsx` / `prisma` CLI / `supertest` 等）を依存ツリーに含まない。
4. 本番イメージサイズが #164 時点より有意に小さい（before/after を PR に記録）。
5. `pnpm test:repo` / `pnpm lint` が緑。回帰防止テストを `tests/` に追加する。

## 4. 設計方針

### 採用方式: `pnpm deploy --prod` による自己完結バンドル

pnpm 推奨の Docker 手法 `pnpm deploy` を採用する。builder で全依存をインストール・ビルド（`prisma generate` + `tsc -b` + bcrypt ネイティブビルド）した後、

```
pnpm --filter @hatchery/server deploy --prod --legacy /prod
```

で `@hatchery/server` の**本番依存のみ**（devDependencies を除外）かつ workspace 依存（`@hatchery/common`）を実体注入した自己完結ツリーを `/prod` に生成する。`--prod` により devDependencies が除外され、受け入れ条件 #3 を満たす。

`pnpm deploy` は本番依存を**新規 install** するため、builder で `prisma generate` 済みの Prisma Client（生成コード + クエリエンジン）は `/prod` には自動では入らない。prisma CLI は devDependency のため `/prod` 側で再 generate もできない。そこで **builder の pnpm 仮想ストア内の生成済み Prisma 生成ディレクトリ（`.pnpm/@prisma+client@<hash>/node_modules/` 配下）を `/prod` の同一 `@prisma/client` パッケージ配下へ `cp -R` で複製**する。deploy は同一 lockfile から同一 hash の `.pnpm` ディレクトリを作るため path は安定し、`@prisma/client` の symlink がこれを解決してランタイムで Prisma Client / クエリエンジンを読み込める。実機で `find` により src/dst を解決し hash 直書きを避ける。

`/prod` には `dist`（ビルド成果物）・`prisma`（スキーマ・migrations）が deploy により含まれる（`@hatchery/server` がパッケージルートになる）。実機検証で確認済み。

さらに、ランタイム不要な **prisma CLI（`.pnpm/prisma@*`、約 50MB）を `/prod` から削除**する。@prisma/client が peer 依存として引き込むが、生成済み Client + クエリエンジンは上で供給済みのため安全に削除でき、受け入れ条件 #3（依存ツリーに prisma CLI が無い）とサイズ削減の両方に寄与する（削除後も `@prisma/client` のロードを実機確認）。

本番ステージは `COPY --from=builder /prod ./`（自己完結ツリー）に絞り、builder の `/app` 全体は持ち込まない。pnpm 自体も本番ステージには入れない。エントリは `node dist/server.js`（`/prod` がパッケージルートのため `server/dist` ではない）。

なお Issue 本文は bcrypt のロード確認を挙げるが、#455（Google-only auth 移行）で bcrypt / passwordHash は廃止済みで、現コードベースは bcrypt を依存に持たない（lockfile・src ともに無し）。パスワードハッシュは使わず `node:crypto` のみ。よって本実装では bcrypt のランタイムロードは確認対象外とし、代わりに `@prisma/client` ロード + `server.js` 起動で受け入れ条件 #2 を満たす。

### 回帰テスト（静的検証）

docker 実行は CI では回さない（CI の build-test-lint は docker 非対象）。`tests/dockerfile-prod-image.test.ts`（vitest, `test:repo`）で Dockerfile の静的構造を検証する:

- 本番ステージが `--prod` 相当の依存削減（`pnpm deploy --prod` または `pnpm prune --prod`）を行う。
- 本番ステージが builder の `/app` 全体を丸ごと COPY しない（`COPY --from=builder /app ./` の再混入防止 = サイズ肥大化のリグレッション防止）。
- 既存の #164 不変条件（壊れた `node_modules/.prisma` への COPY を含まない）も維持する。

end-to-end のビルド成功・起動確認・サイズ比較はローカル実機で行い PR にログ要約を残す。

## 5. 影響範囲

- `server/Dockerfile`（本番ステージの再構成）
- `tests/dockerfile-prod-image.test.ts`（新規）
- ユーザー可視の振る舞いは変わらない（インフラのみ）。e2e usecases 更新不要。

## 6. テスト計画（TDD）

`tests/dockerfile-prod-image.test.ts`:

- 本番ステージで `pnpm deploy --prod` もしくは `pnpm prune --prod` 相当の本番依存削減を行う行が存在する。
- `COPY --from=builder /app ./`（builder の /app 丸ごと再利用）を含まない。
- 既存の #164 不変条件（壊れた `node_modules/.prisma` COPY を含まない）も維持する。

## 7. リスク・未決事項

- `pnpm deploy` の Prisma 生成物は新規 install では入らないため、builder の生成済みディレクトリを `cp -R` で複製して確実化する（本設計で採用）。実機ビルド＆起動で担保する。
- prisma CLI 削除は @prisma/client の peer を欠くが、ランタイムは生成済み Client + エンジンのみ要求するため安全（実機確認済み）。
- CI は docker を回さないため、end-to-end はローカル反復で担保し PR にログを残す。
