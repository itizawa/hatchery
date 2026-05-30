# 設計書: DDoS攻撃対策の実装 (#34)

## 1. 目的 / 背景

Express サーバ（ADR-0004: Express 5 / Node.js 22）に対する DoS／過負荷攻撃を緩和する防御機構を実装する。
具体的には **IP ベースのレート制限**・**リクエストボディサイズ制限**・**リクエストタイムアウト**を導入し、
いずれも **環境変数で調整可能**にして本番環境へ対応する。

定時方式（1 日数回の API コール、ADR-0009）という設計上、常時大量アクセスは想定しないが、
公開 API である以上、悪意あるリクエストからサーバを保護する必要がある。

## 2. スコープ（やること / やらないこと）

### やること
- IP ベースのレート制限ミドルウェア（ウィンドウ内リクエスト上限、超過時 429）
- リクエストボディサイズ制限（`express.json({ limit })`、超過時 413）
- リクエストタイムアウトミドルウェア（処理が規定時間を超えたら 503）
- 上記の設定値を `server/src/config/env.ts`（Zod 検証）で環境変数化し、`server/.env.example` にテンプレート追記
- `createApp` への組み込み、`server.ts` での http.Server レベルのタイムアウト設定
- TDD によるユニット／統合テスト

### やらないこと（スコープ外）
- 認証・認可、セキュアヘッダ、CORS、CSRF/XSS 対策（**Issue #35** の範囲）
- 外部 WAF / CDN / リバースプロキシ（インフラ層）の構成
- 分散環境での共有レートリミット（Redis 等）。本 Issue はインメモリ（単一プロセス）実装に留める
- Prisma の DB クエリタイムアウトの実コード化（DB 接続が必要なためテスト不能）。`DATABASE_URL` のクエリパラメータ（`connect_timeout` / `pool_timeout`）で設定する方針をドキュメント化するに留める

### 受け入れ条件の読み替え（重要）
- 原文の「バッチシーン生成エンドポイント（`POST /api/scenes/batch`）の保護」は、**ADR-0009 で Scene が廃止され、定時バッチは Express とは別エントリポイント（HTTP エンドポイントではない）**になっているため、該当エンドポイントは存在しない。
  → **API 全体（全ルート）にグローバルでレート制限を適用する**ことで、原文の「API 表面を保護する」意図を満たす。

## 3. 受け入れ条件（テストに落とせる粒度）

- [ ] `createRateLimiter({ windowMs, max })` は、同一 IP からウィンドウ内 `max` 件までは `next()` し、`max` を超えると **429** と `{ error: "TooManyRequests" }` を返す
- [ ] レート制限はウィンドウ経過後にカウンタがリセットされ、再び通過できる（注入可能なクロックで検証）
- [ ] 429 応答には `Retry-After` ヘッダ（秒）が付与される
- [ ] `createApp` 経由でも、上限を超えたリクエストに 429 が返る（統合）
- [ ] ボディサイズが上限を超えると **413**（`{ error: "PayloadTooLarge" }`）を返し、上限内は通常処理される
- [ ] `createRequestTimeout(ms)` は、処理が `ms` を超えたリクエストに **503**（`{ error: "RequestTimeout" }`）を返す。`ms` 内に完了した応答はそのまま返る
- [ ] `loadEnv` が `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` / `REQUEST_BODY_LIMIT` / `REQUEST_TIMEOUT_MS` を読み取り、未設定時は既定値を返す。不正値（非数値・非正）は ZodError で起動時に弾く
- [ ] `server/.env.example` に上記 4 変数のテンプレートが記載されている

## 4. 設計方針

層分離（ADR-0004）を守り、防御はすべて **Express ミドルウェア**として `server/src/middleware/` に置く。
ドメイン（common）には踏み込まない（純粋なインフラ的横断関心事）。

- **`middleware/rateLimiter.ts`** — `createRateLimiter(options)`。インメモリ `Map<ip, { count, resetAt }>` の固定ウィンドウ方式。テスト容易性のためクロック `now()` を注入可能にする。新規ウィンドウ作成時に期限切れエントリを掃除し、メモリ肥大を防ぐ。
- **`middleware/requestLimits.ts`** — `createJsonBodyParser(limit)`（`express.json({ limit })` の薄いラッパ）と `createRequestTimeout(ms)`（`res.setTimeout` で 503 応答）。
- **`middleware/errorHandler.ts`** — body-parser が投げる `PayloadTooLargeError`（`status === 413` / `type === "entity.too.large"`）を検出して **413** に変換。それ以外は従来どおり 500。
- **`config/env.ts`** — `ServerEnv` に 4 設定を追加（Zod、既定値つき）。
- **`app.ts`** — `AppDeps` に任意の `security?: SecurityOptions` を追加。ミドルウェア適用順は **レート制限 → タイムアウト → JSON ボディパーサ（制限つき）→ session/passport → routes → errorHandler**。既定値は既存テストを壊さない緩い値（max=300/分・body=100kb・timeout=30s）。
- **`server.ts`** — `loadEnv()` の値を `createApp` に渡し、加えて `app.listen` が返す http.Server に `requestTimeout` / `headersTimeout` を設定。

### なぜ依存を追加しないか
`express-rate-limit` 等の外部パッケージは候補だが、本リポジトリは CI で `pnpm install --frozen-lockfile` を使う。
新規依存は lockfile 変更を伴い、レビュー範囲を広げる。固定ウィンドウのインメモリ実装は数十行で TDD 可能なため、
**依存ゼロ**で実装する（Issue 原文も「express-rate-limit 等」＝同等手段で可と明記）。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: server）

- 追加: `server/src/middleware/rateLimiter.ts` + `.test.ts`
- 追加: `server/src/middleware/requestLimits.ts` + `.test.ts`
- 変更: `server/src/middleware/errorHandler.ts`（413 対応）+ `.test.ts` 追加
- 変更: `server/src/config/env.ts`（4 設定追加）/ `server/src/config/env.test.ts`（テスト追加）
- 変更: `server/src/app.ts`（ミドルウェア組み込み・`SecurityOptions`）/ `server/src/app.security.test.ts` 追加
- 変更: `server/src/server.ts`（http.Server タイムアウト設定）
- 変更: `server/.env.example`
- client / common / docs への影響なし（依存方向 server → common を維持）

### テストファイル配置について
Issue 原文は `server/src/middleware/__tests__/rateLimiter.test.ts` を例示するが、本リポジトリの既存規約は
**co-located な `*.test.ts`**（例: `validateBody.test.ts`）。一貫性を優先し co-located 配置とする。

## 6. テスト計画（TDD で書くテスト一覧）

1. `rateLimiter.test.ts`
   - 上限内は通過（200）
   - 上限超過で 429 + `{ error: "TooManyRequests" }` + `Retry-After` ヘッダ
   - ウィンドウ経過後（クロック前進）でリセットされ再通過
2. `requestLimits.test.ts`
   - `createJsonBodyParser`: 上限内 JSON は通過、上限超過で 413（errorHandler 併用）
   - `createRequestTimeout`: 規定時間内応答はそのまま、超過で 503 + `{ error: "RequestTimeout" }`
3. `errorHandler.test.ts`
   - 413 系エラーは 413 に変換、その他は 500
4. `env.test.ts`（追記）
   - 4 設定の既定値・読み取り・不正値で throw
5. `app.security.test.ts`
   - `createApp` 経由で低い上限を設定し、超過リクエストに 429

## 7. リスク・未決事項

- **インメモリ実装の限界**: 複数プロセス／水平スケール時はプロセス間でカウンタが共有されない。MVP は単一プロセス前提のため許容。将来スケール時は Redis 等の共有ストアへ差し替える（拡張ポイントとして `createRateLimiter` のインターフェースは store 差し替え可能な素朴設計にしておく）。
- **タイムアウトテストの安定性**: 実タイマーを使うため、十分なマージン（例: timeout 50ms / 処理 400ms）を取り flaky を避ける。タイムアウトは `res.setTimeout`（ソケットアイドル）ではなく、リクエスト開始からの実時間 `setTimeout` で測り、応答完了（`finish`）/切断（`close`）でクリアする。
- **リバースプロキシ配下の IP**: レート制限は `req.ip` で数えるため、LB/プロキシ背後では `app.set("trust proxy", ...)` をデプロイ側で設定しないと全クライアントがプロキシ IP に集約される。本 MVP は単一プロセス前提のためコードでは強制せず、`app.ts` にコメントで明記するに留める（`trust proxy` を無条件に有効化すると X-Forwarded-For 偽装を許す footgun になり得るため、運用判断に委ねる）。
- **二重応答の防止**: タイムアウト 503 送出後に遅延ハンドラが応答/`next(err)` するケースに備え、`errorHandler` は `res.headersSent` 時に Express 既定ハンドラへ委譲し `ERR_HTTP_HEADERS_SENT` の未捕捉を防ぐ。http.Server の `requestTimeout` はミドルウェアより長く設定し、503 が先に返るようにする。
- **DB クエリタイムアウト**: 本 Issue ではコード化せず、`DATABASE_URL` のクエリパラメータでの設定方針をドキュメント化に留める（Prisma 接続が必要でユニットテスト不能なため）。
