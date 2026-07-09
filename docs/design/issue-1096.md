# 設計書: client/functions/_middleware.ts の Basic 認証ゲート分岐のテストを追加する (#1096)

## 1. 目的 / 背景

`client/functions/_middleware.ts`（Cloudflare Pages Functions、#146）は dev 環境全体に Basic 認証をかけるゲートで、以下の重要な分岐を持つが対応するテストが存在しない。

- `/api/*` へのリクエストは Basic 認証を素通りさせる（Google OAuth コールバックが 401 で弾かれるのを防ぐための意図的な除外）。
- `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` が未設定の環境（本番相当）では認証自体をスキップする。
- 上記いずれにも該当せず認証ヘッダーが不正な場合は 401 + `WWW-Authenticate` ヘッダーを返す。

`/api/*` 除外分岐にバグがあると意図せず全パスに Basic 認証がかかり OAuth ログインが壊れる、あるいは逆に除外範囲が広がりすぎて Basic 認証が無効化されるといった致命的な回帰が起こり得るが、テストが無くその検出手段がない。

## 2. スコープ（やること / やらないこと）

### やること

- `client/functions/_middleware.test.ts` を新設し、`onRequest` の 3 分岐を検証する。
- 既存の `basicAuth.ts`（`parseBasicAuth` / `validateBasicAuth`）のロジック自体は変更しない（既に `basicAuth.test.ts` でテスト済み）。

### やらないこと

- Basic 認証の仕組み自体の変更（ロジック修正は対象外）。
- `_middleware.ts` のリファクタリング（挙動を変えない）。

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `pathname` が `/api/` で始まるリクエストは、`BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` が設定されていても `next()` の結果がそのまま返る（Basic 認証されない）。
2. `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` が未設定（`undefined`）の場合、`/api/` 以外のパスでも `next()` の結果がそのまま返る（認証スキップ）。
3. 環境変数が設定されている状態で、正しい Basic 認証ヘッダーを持つリクエストは `next()` の結果を返す。
4. 環境変数が設定されている状態で、認証ヘッダーが無いリクエストは 401 と `WWW-Authenticate` ヘッダーを返す。
5. 環境変数が設定されている状態で、不正な認証ヘッダーのリクエストは 401 と `WWW-Authenticate` ヘッダーを返す。
6. `pnpm turbo run build test lint` が緑であること。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- 既存の `communities/[id].test.ts` と同様に `@vitest-environment node` を指定し、`Request` / `Response` の Web 標準 API をそのまま使う。
- `onRequest` を直接呼び出す最小限のモックコンテキスト（`request` / `env` / `next`）を用意する。`params` / `data` / `waitUntil` / `passThroughOnException` は型上必須だが `onRequest` 内部では未使用のため、テストのコンテキストオブジェクトはダミー値で埋める。
- `next()` は `vi.fn()` で「素通り」を検証できるよう固有の `Response`（例: `new Response("passthrough")`）を返すモックにし、戻り値が同一であることをテストで確認する。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client / common / server / docs）

- 対象ワークスペース: `client` のみ（テストファイル新設のみ、プロダクションコードの変更なし）。
- `common` / `server` への影響なし。

## 6. テスト計画（TDDで書くテスト一覧）

`client/functions/_middleware.test.ts`:

1. `/api/` 始まりのパス + 環境変数設定済み → `next()` の結果を返す（Basic 認証されない）
2. `/api/` 始まりのパス + 環境変数未設定 → `next()` の結果を返す
3. `/api/` 以外のパス + 環境変数未設定 → `next()` の結果を返す（スキップ）
4. `/api/` 以外のパス + 環境変数設定済み + 正しい認証ヘッダー → `next()` の結果を返す
5. `/api/` 以外のパス + 環境変数設定済み + 認証ヘッダーなし → 401 + `WWW-Authenticate` ヘッダー
6. `/api/` 以外のパス + 環境変数設定済み + 不正な認証ヘッダー → 401 + `WWW-Authenticate` ヘッダー

## 7. リスク・未決事項

- 特になし。プロダクションコードの変更を伴わない、既存分岐に対するテスト追加のみのスコープ。
- ユーザー可視の振る舞い変更は無い（dev 環境の内部ゲートのテスト追加のみ）ため `e2e/usecases.md` の更新は不要と判断する。
