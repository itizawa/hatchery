# 設計書: セキュリティ全般対策（CSRF、XSS、認証・認可）(#35)

## 1. 目的 / 背景

Express サーバ（ADR-0004: Express 5 / Node.js 22）と React SPA（ADR-0003）に対する
一般的な Web 脅威（OWASP Top 10）への防御を整える。Issue #34 で DoS／過負荷対策
（レート制限・ボディサイズ・タイムアウト）は実装済みのため、本 Issue では **Phase 1（必須）**
の以下に集中する:

- **セキュアなレスポンスヘッダ**（`X-Content-Type-Options` ほか）
- **CORS の適切な設定**（SPA が別オリジンから API を叩く前提）
- **セキュリティ設定の一元管理**

加えて、Issue が「確認」を求める XSS / CSRF / 入力検証 / SQLi の各項目は、既存実装を
**監査して本設計書に結論を記録**する（多くは既存の仕組みで充足済み）。

認証スキームの決定・RBAC などの **Phase 2 は後続 Issue**（Issue 原文どおり）に委ね、本 Issue では扱わない。

## 2. スコープ（やること / やらないこと）

### やること（Phase 1）
- セキュアレスポンスヘッダミドルウェア（`X-Content-Type-Options: nosniff` / `X-Frame-Options: DENY` /
  `X-XSS-Protection: 1; mode=block` / `Referrer-Policy: no-referrer` / 本番のみ `Strict-Transport-Security` /
  `X-Powered-By` の除去）
- CORS ミドルウェア（オリジン許可リスト方式・資格情報付き・プリフライト対応）
- セキュリティ設定の一元化（`server/src/config/security.ts` にヘッダ／CORS のポリシー定数、
  `config/env.ts` に `CORS_ALLOWED_ORIGINS` の Zod 検証を追加）
- `createApp` への組み込み・`server.ts` での本番判定（HSTS 有効化・CORS オリジン注入）
- `server/.env.example` に `CORS_ALLOWED_ORIGINS` テンプレート追記
- TDD によるユニット／統合テスト
- XSS / CSRF / 入力検証 / SQLi の既存実装監査（本書 §7 に結論を記録）

### やらないこと（スコープ外）
- 認証スキームの決定（JWT/Session/OAuth）・RBAC/ABAC 認可設計（**Phase 2 / 後続 Issue**）
- DoS／過負荷対策（**Issue #34** で実装済み）
- CSP（`Content-Security-Policy`）の本格導入。SPA のアセット構成に依存し誤設定で機能停止を招くため、
  本 Issue では導入せず後続課題とする（Issue の必須項目にも含まれない）
- CSRF トークン機構の追加実装。後述の監査結果（SameSite Cookie で MVP は充足）に基づき本 Issue では追加しない

## 3. 受け入れ条件（テストに落とせる粒度）

### セキュアヘッダ（`createSecureHeaders`）
- [ ] 応答に `X-Content-Type-Options: nosniff` が付与される
- [ ] 応答に `X-Frame-Options: DENY` が付与される
- [ ] 応答に `X-XSS-Protection: 1; mode=block` が付与される
- [ ] 応答に `Referrer-Policy: no-referrer` が付与される
- [ ] `enableHsts: true` のとき `Strict-Transport-Security` が付与され、既定（false）では付与されない
- [ ] 応答に `X-Powered-By` が含まれない（Express 既定の露出を除去）

### CORS（`createCors`）
- [ ] 許可リストに含まれる `Origin` のリクエストには、`Access-Control-Allow-Origin` にそのオリジンを反映し、
      `Access-Control-Allow-Credentials: true` と `Vary: Origin` を付与する
- [ ] 許可リストに**含まれない** `Origin` には `Access-Control-Allow-Origin` を付与しない
- [ ] 許可オリジンからのプリフライト（`OPTIONS` + `Access-Control-Request-Method`）に **204** を返し、
      `Access-Control-Allow-Methods` / `Access-Control-Allow-Headers` を付与する
- [ ] 許可リストが `["*"]` のときは任意のオリジンを反映する（資格情報併用のためワイルドカードではなく反映）

### 設定（`config/env.ts` / `config/security.ts`）
- [ ] `loadEnv` が `CORS_ALLOWED_ORIGINS`（カンマ区切り）を読み取り `string[]` に整形する（前後空白除去・空要素除去）。
      未設定時は `[]` を返す
- [ ] `server/.env.example` に `CORS_ALLOWED_ORIGINS` のテンプレートが記載されている

### 統合（`createApp`）
- [ ] `createApp` 経由の応答（例: `/health`）にセキュアヘッダが付与される
- [ ] `corsAllowedOrigins` を渡した `createApp` で、許可オリジンに CORS ヘッダが付与される

## 4. 設計方針

層分離（ADR-0004）を守り、防御は **Express ミドルウェア**として `server/src/middleware/` に置く。
ドメイン（common）には踏み込まない（インフラ的横断関心事）。設定の単一情報源は `server/src/config/` に集約する。

- **`config/security.ts`** — セキュリティポリシーの単一情報源。`buildSecurityHeaders(enableHsts)` が
  付与すべきヘッダの `Record<string,string>` を返す（静的ヘッダ + 条件付き HSTS）。CORS のメソッド／許可ヘッダ／
  `Max-Age` 既定（`CORS_DEFAULTS`）もここに置く。`#34` の数値既定は引き続き `env.ts` の `SECURITY_DEFAULTS` が持ち、
  本書では**ヘッダ／CORS のポリシー**を `security.ts` が持つ役割分担にする（env 変数の parse は env.ts に一本化）。
- **`middleware/secureHeaders.ts`** — `createSecureHeaders({ enableHsts })`。`buildSecurityHeaders` の結果を
  応答に `res.setHeader` し、`res.removeHeader("X-Powered-By")` を行う薄いミドルウェア。
- **`middleware/cors.ts`** — `createCors({ allowedOrigins })`。`Origin` を許可リスト（または `*`）と照合し、
  一致時のみ `Access-Control-Allow-Origin`（反映）+ `Allow-Credentials` + `Vary: Origin` を付与。
  プリフライト（`OPTIONS` かつ `Access-Control-Request-Method` あり）は `Allow-Methods`/`Allow-Headers`/`Max-Age`
  を付けて **204** で打ち切る。外部依存（`cors` パッケージ）は追加しない（#34 と同方針＝lockfile 変更を避ける）。
- **`config/env.ts`** — `ServerEnv` に `corsAllowedOrigins: string[]` を追加（Zod、`CORS_ALLOWED_ORIGINS` を
  カンマ区切りで parse）。
- **`app.ts`** — `SecurityOptions` に `corsAllowedOrigins?: string[]` と `enableHsts?: boolean` を追加。
  適用順は **セキュアヘッダ → CORS →（#34 のレート制限 → タイムアウト → ボディパーサ）→ session/passport → routes → errorHandler**。
  ヘッダ／CORS は最前段に置き、全応答（エラー含む）に効かせる。既定は既存テストを壊さない値（HSTS 無効・CORS 許可リスト空）。
- **`server.ts`** — `loadEnv()` の `corsAllowedOrigins` を渡し、`enableHsts` は `NODE_ENV === "production"` で導出
  （session cookie の `secure` と同じ判定パターン）。

### X-Powered-By の除去
Express は既定で `X-Powered-By: Express` を送り、技術スタックを露出する。`app.disable("x-powered-by")` ではなく、
ミドルウェアで `res.removeHeader` することで、ヘッダ方針を `secureHeaders` に一元化する（テストも同一経路で検証可能）。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: server / docs）

- 追加: `server/src/config/security.ts` + `security.test.ts`
- 追加: `server/src/middleware/secureHeaders.ts` + `secureHeaders.test.ts`
- 追加: `server/src/middleware/cors.ts` + `cors.test.ts`
- 変更: `server/src/config/env.ts`（`corsAllowedOrigins` 追加）/ `env.test.ts`（テスト追加）
- 変更: `server/src/app.ts`（ヘッダ／CORS 組み込み・`SecurityOptions` 拡張）/ `app.security.test.ts`（統合テスト追加）
- 変更: `server/src/server.ts`（`enableHsts` 導出・`corsAllowedOrigins` 注入）
- 変更: `server/.env.example`（`CORS_ALLOWED_ORIGINS`）
- 追加: 本設計書 `docs/design/issue-35.md`
- client / common への影響なし（依存方向 server → common を維持）

### テストファイル配置について
Issue 原文は `server/src/middleware/__tests__/secureHeaders.test.ts` を例示するが、本リポジトリの既存規約は
**co-located な `*.test.ts`**（例: `requestLimits.test.ts`）。一貫性を優先し co-located 配置とする
（vitest の既定 include は両方を拾うため機能差はない）。

## 6. テスト計画（TDD で書くテスト一覧）

1. `config/security.test.ts`
   - `buildSecurityHeaders(false)` は必須ヘッダ4種を含み HSTS を含まない
   - `buildSecurityHeaders(true)` は HSTS を含む
2. `middleware/secureHeaders.test.ts`
   - 応答に必須ヘッダ4種が付与される / `X-Powered-By` が無い
   - `enableHsts` の有無で HSTS の付与が切り替わる
3. `middleware/cors.test.ts`
   - 許可オリジン → ACAO 反映 + Allow-Credentials + Vary
   - 不許可オリジン → ACAO 無し
   - プリフライト（許可）→ 204 + Allow-Methods/Headers
   - `["*"]` → 任意オリジン反映
4. `config/env.test.ts`（追記）
   - `CORS_ALLOWED_ORIGINS` のカンマ区切り parse・空白除去・未設定で `[]`
5. `app.security.test.ts`（追記）
   - `createApp` 経由の `/health` 応答にセキュアヘッダ
   - `corsAllowedOrigins` 指定時に許可オリジンへ CORS ヘッダ

## 7. リスク・未決事項 / 既存実装の監査結果

### 監査結果（Issue の「確認」項目への回答）
- **XSS**: React 19 は JSX 補間を既定で自動エスケープ。`client/src` に `dangerouslySetInnerHTML` の使用は
  **0 件**（grep 確認済み）。MUI コンポーネントも文字列を子要素として安全に描画する。→ 追加対応不要。
- **CSRF**: 認証は session + Cookie（`app.ts`）。Cookie は `httpOnly` かつ `sameSite: "lax"`、本番は `secure: true`。
  SameSite=Lax によりクロスサイトの自動送信（特に POST）が抑止されるため、MVP では CSRF トークン無しで充足と判断。
  → 本 Issue ではトークン機構を追加しない（後続でフォームに状態変更 GET を作らない前提を維持）。
- **入力検証**: リクエスト検証は common の Zod スキーマ + `validateBody`（#で実装済み）。→ 既存方針を維持。
- **SQLi**: 永続化は Prisma（パラメタライズドクエリ）。生 SQL の文字列連結は不使用。→ 回避済み。

### リスク
- **X-XSS-Protection の是非**: 同ヘッダは最新ブラウザで非推奨（一部は `0` 推奨）だが、Issue が
  `1; mode=block` を明示要求しているため受け入れ条件どおり実装する。古いブラウザ向けの保険であり、
  実害は無いが将来 CSP 導入時に再評価する。
- **CORS とワイルドカード + 資格情報**: `Access-Control-Allow-Origin: *` と `Allow-Credentials: true` は
  ブラウザ仕様上併用不可。許可リスト一致時は**具体オリジンを反映**することでこの制約を回避する
  （`["*"]` 設定でも反映方式を採る）。
- **HSTS の適用条件**: HSTS は HTTPS 前提のため `NODE_ENV !== production` では送らない（誤って HTTP 開発環境に
  効かせるとローカルアクセス不能になり得るため）。デプロイ（HTTPS 終端）側の整合は運用で担保。
- **プリフライトの早期打ち切り**: 許可オリジンのプリフライトは 204 で打ち切る。不許可オリジンのプリフライトは
  ACAO を付けず後続へ流す（ブラウザ側で遮断される）。
