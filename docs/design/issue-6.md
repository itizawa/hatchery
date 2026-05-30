# 設計書: Setup: server スタック（Express 5 / Prisma / PostgreSQL・層分離・定時バッチ別エントリ） (#6)

## 1. 目的 / 背景

ADR-0004 に従い、API サーバの土台を `server/` に実装する。Node.js 22+（実環境は 26）/ Express 5 / Prisma / PostgreSQL、層分離（ルーティング / ユースケース / ドメイン[common] / 永続化[Prisma]）。リクエスト検証は common（#5 で実装済み）の Zod スキーマで行う。定時バッチ（シーン生成）は Express とは**別エントリポイント**として構成する。

現状 `server/` は雛形（`sum` 関数のみ）で、許可方向 `server → common` を示すだけのスタブ。本 Issue でこれを Express/Prisma/バッチの土台に差し替える。

## 2. スコープ（やること / やらないこと）

### やること
- Express 5 アプリ本体（`createApp`）と起動エントリ（API プロセス）
- 最小エンドポイント: ヘルスチェック（`GET /health`）+ シーン一覧/作成（`GET /scenes` / `POST /scenes`）の最小実装
- 層分離ディレクトリ構成（routes / usecases / persistence / middleware / batch、ドメインは common 参照）
- Prisma 導入: `schema.prisma`（MVP ドメイン対応）+ 初期マイグレーション
- common の Zod スキーマでリクエストボディを検証する汎用ミドルウェア
- 定時バッチ用の別エントリポイント（`runSceneBatch` スタブ + CLI 起動）
- common に依存・client に非依存（既存 ESLint import 制約で担保）
- Vitest による DB 非依存の最小テスト（ヘルス / 検証ミドルウェア / ユースケース＝インメモリ注入 / バッチスタブ）と、DB がある時のみ走る統合テスト

### やらないこと（スコープ外）
- OpenAPI（`openapi.json`）生成・型配布（ADR-0006 / #8）
- シーン生成の本実装（LLM 1 コール → JSON 検証 → 永続化）。本 Issue ではスタブ
- 認証・本番デプロイ・スケジューラ選定

## 3. 受け入れ条件（テストに落とせる粒度）

1. **AC-1 ヘルスチェック**: `createApp()` が返す Express アプリに対し `GET /health` が `200` と `{ status: "ok" }` を返す（supertest）。
2. **AC-2 検証ミドルウェア（正常系）**: common の `SceneSchema` を使う `validateBody` を通すと、正しい Scene JSON の `POST /scenes` は `201` を返し、保存結果が返る。
3. **AC-3 検証ミドルウェア（異常系）**: 不正なボディ（例: `messages` が空、`text` が空）の `POST /scenes` は `400` を返し、エラー詳細（`issues`）を含む。
4. **AC-4 ユースケースの DB 非依存性**: `listScenes` / `createScene` ユースケースが `SceneRepository` インターフェースに依存し、インメモリ実装を注入したテストが緑（Express・Prisma なしで完結）。
5. **AC-5 定時バッチ別エントリ**: `runSceneBatch(deps)` が Express アプリと独立に import・実行でき、スタブのシーンをリポジトリへ保存して結果を返す。バッチモジュールは Express を import しない。
6. **AC-6 Prisma スキーマ妥当性**: `prisma/schema.prisma` が MVP ドメイン（Employee / Channel / Scene / Message / Task）に対応し、`prisma validate` が成功する。
7. **AC-7 依存方向**: server のコードは `@hatchery/common` を import し、`@hatchery/client` を import しない（既存の `tests/dependency-direction.test.ts` と ESLint で担保）。
8. **AC-8 全テスト緑 + lint 通過**: `pnpm --filter @hatchery/server test` と `pnpm --filter @hatchery/server lint` が緑。

### DB 統合（実マイグレーション）について
- 受け入れ条件「PostgreSQL への接続・マイグレーションが通る」は、(a) `prisma validate` による静的検証（CI・常時実行）と、(b) docker で起動した PostgreSQL に対する `prisma migrate deploy` の実行（`DATABASE_URL` がある時のみ走る統合テスト）の二段で満たす。
- DB を伴うテストは `describe.skipIf(!process.env.DATABASE_URL)` でゲートし、DB 無し環境でも `vitest run` は緑のまま（CI が DB レスでも壊れない）。実マイグレーションは実装時に docker postgres で実行して確認し、PR にログを添付する。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### 層分離（ADR-0004）
```
server/
  prisma/
    schema.prisma              # MVP ドメインの永続化スキーマ
    migrations/                # 初期マイグレーション（コミット対象）
  src/
    index.ts                   # パッケージエントリ（createApp / runSceneBatch を re-export）
    app.ts                     # createApp(deps): Express アプリ生成（listen しない＝テスト可能）
    server.ts                  # API 起動エントリ（createApp + listen）
    config/env.ts              # 環境変数（PORT / DATABASE_URL）の読み出し
    routes/health.ts           # GET /health
    routes/scenes.ts           # GET /scenes, POST /scenes
    middleware/validateBody.ts # common Zod スキーマでボディ検証 → 400 / next
    middleware/errorHandler.ts # 集約エラーハンドラ
    usecases/listScenes.ts     # SceneRepository に依存（DB 非依存）
    usecases/createScene.ts
    persistence/prismaClient.ts        # PrismaClient シングルトン
    persistence/sceneRepository.ts     # SceneRepository IF + Prisma 実装 + InMemory 実装
    batch/runSceneBatch.ts     # 定時バッチ本体（スタブ。Express を import しない）
    batch/index.ts             # 定時バッチ CLI エントリ
```

### 依存方向（層）
`routes → usecases → persistence(IF)` の一方向。ドメイン型は common。`usecases` は `SceneRepository` インターフェースにのみ依存し、具体（Prisma / InMemory）は `app.ts` / エントリで注入（DI）。これにより ADR-0004 の「ドメインロジックを Express・Prisma から独立」を満たし、ユースケースを DB 無しでテストできる。

### Prisma スキーマ（MVP）
- `Employee(id, displayName, role?)`
- `Channel(id, label)`
- `Scene(id, summary, createdAt)` — 1 定時の 1 シーン。`summary` は common の `Scene.scene`（あらすじ）。
- `Message(id, sceneId→Scene, speaker, channel, text, order)` — シーンに属する発言列。
- `Task(id, text, status, employeeId→Employee)` — `status` は enum `TaskStatus { new, done }`。
- リレーション: `Scene 1―N Message`、`Employee 1―N Task`。

### 検証ミドルウェア
`validateBody(schema: ZodType)` を返す高階関数。`schema.safeParse(req.body)` が失敗なら `400 { error: "ValidationError", issues }`、成功なら `req.body` を parse 済みデータで上書きし `next()`。common の `SceneSchema` 等をそのまま渡す（二重定義を避ける・ADR-0005/0006 の方針）。

### 定時バッチ
`runSceneBatch({ sceneRepository, generate })` がシーンを 1 つ生成（本 Issue では固定スタブの `Scene`）してリポジトリへ保存し、保存結果を返す。`batch/index.ts` は実 Prisma リポジトリを組み立てて呼ぶ CLI。Express を一切 import しないことで「別プロセスで独立起動」を担保。

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: **server**（新規実装）。common / client / docs は変更しない。
- `server/package.json`: `express` / `@prisma/client` / `zod` を dependencies、`prisma` / `supertest` / `tsx` / `@types/express` / `@types/supertest` を devDependencies に追加。`dev` / `db:generate` / `db:migrate` / `batch` 等の scripts を追加。
- `server/src/index.ts` / `index.test.ts`: 雛形（`sum`）を本実装の re-export に差し替え。
- ルート `pnpm-lock.yaml` 更新（依存追加）。
- 既存のリポジトリ検証テスト（`tests/workspaces.test.ts` 等）は server を既に 4 ワークスペースとして期待しており、影響なし（緑のまま）。

## 6. テスト計画（TDD で書くテスト一覧）

DB 非依存（常時実行・CI 緑の対象）:
- `src/routes/health.test.ts`: AC-1（GET /health → 200 / `{status:"ok"}`）
- `src/middleware/validateBody.test.ts`: AC-2/AC-3（正常 → next・parse 済み、異常 → 400 / issues）
- `src/routes/scenes.test.ts`: AC-2/AC-3（POST /scenes 正常 201・異常 400、GET /scenes 一覧）— InMemory リポジトリ注入
- `src/usecases/listScenes.test.ts` / `createScene.test.ts`: AC-4（インメモリ注入で完結）
- `src/persistence/sceneRepository.test.ts`: InMemorySceneRepository の保存・取得
- `src/batch/runSceneBatch.test.ts`: AC-5（スタブ生成 → 保存 → 結果）
- `src/index.test.ts`: パッケージエントリが `createApp` / `runSceneBatch` を export

DB 依存（`DATABASE_URL` がある時のみ・`skipIf`）:
- `src/persistence/prismaSceneRepository.int.test.ts`: AC-6 実 PostgreSQL に対する保存・取得（マイグレーション適用済み前提）

静的検証（コマンド）:
- `prisma validate`（AC-6）/ docker postgres への `prisma migrate deploy`（実装時に実行しログを PR へ）

## 7. リスク・未決事項

- **DB を伴う検証の CI 化**: 本 Issue では DB 統合テストを `skipIf` で任意実行とし、CI への PostgreSQL サービス組み込みはスコープ外（フォローアップ）。実マイグレーションは実装時に docker で確認する。
- **Prisma enum 値 `new`**: Prisma スキーマ上は識別子として許容される想定。`prisma validate` で確認する。
- **Express 5 の型**: `@types/express@^5` を使用。エラーハンドラのシグネチャ差異に注意。
- シーン生成の本実装・スケジューラ・OpenAPI は後続 Issue（#8 ほか）に委ねる。
