# Issue #559 設計書: 公開 GET API への Cache-Control 付与

## 背景・目的

server は GET レスポンスに `Cache-Control` を一切付与しておらず、Cloudflare エッジ/ブラウザ HTTP キャッシュが効かない。ADR-0030 のとおり本プロダクトは「1 日数回の定時でしかコンテンツが増えない」read-heavy 構造で、公開 GET に `public, s-maxage, stale-while-revalidate` を付与すればエッジキャッシュが極めて効きやすい（ADR-0015 §決定の方針）。

最重要の制約: 認証済みリクエストでは購読/vote などユーザー個別データが応答に乗りうる。これを `public` でエッジキャッシュすると他人のデータが別ユーザーに配信される事故になる。public/private の切り分けが本 Issue の肝。

## 受け入れ条件 → 入出力

| AC | 入力 | 期待出力 |
|----|------|----------|
| 1 | `server/src/config/security.ts` | キャッシュ方針を一元化。`CACHE_DEFAULTS` 定数 + `buildPublicCacheControl()` / `buildPrivateCacheControl()` 純粋関数。env 上書き余地（`SECURITY_DEFAULTS` と同様の `CACHE_DEFAULTS`）。テストで既定値を検証。 |
| 2 | public GET（未認証）: `/api/feed`・`/api/communities`・コミュニティ詳細(`/:slug/feed`,`/:slug/recent-workers`)・post 取得(`/api/posts/:id`)・`/sitemap.xml` | `Cache-Control: public, s-maxage=<N>, stale-while-revalidate=<M>` |
| 3 | private GET: `/api/auth/*`（`/me`・購読状態 #421 含む）・`/api/admin/*`・`token-usage`・`batch-logs` | `Cache-Control: private, no-store`。`public`/`s-maxage` を含まない |
| 4 | 認証済みリクエストで public 候補 GET にアクセス | `private, no-store`（公開キャッシュ禁止）。未認証時のみ public |
| 5 | s-maxage 秒数 | 設計書で明文化（下記）。`stale-while-revalidate` 併用 |
| 6 | POST/PUT/PATCH/DELETE | public キャッシュを付けない（既存挙動を壊さない） |
| 7 | 境界・ビルド | server のみ。build/test/lint 緑 |

## 設計判断

### キャッシュ方針の一元化（AC1）

`server/src/config/security.ts` に以下を追加する（`CORS_DEFAULTS`/`buildSecurityHeaders` のパターンを踏襲）。

- `CACHE_DEFAULTS = { sMaxageSeconds, staleWhileRevalidateSeconds }`（既定値の単一情報源）。
- `buildPublicCacheControl({ sMaxageSeconds, staleWhileRevalidateSeconds })` → `"public, s-maxage=<N>, stale-while-revalidate=<M>"` を組み立てる純粋関数。
- `buildPrivateCacheControl()` → `"private, no-store"` を返す純粋関数（引数なし）。

`Cache-Control` の文字列を各ルートに直書きしない。env 上書きは `config/env.ts` の `SECURITY_DEFAULTS` と同居させず、キャッシュ専用に `CACHE_S_MAXAGE_SECONDS` / `CACHE_STALE_WHILE_REVALIDATE_SECONDS` を `EnvSchema` に追加し、`ServerEnv.cacheSMaxageSeconds` / `cacheStaleWhileRevalidateSeconds` として公開する。`createApp` の `SecurityOptions` に注入できるようにし、テストで既定値（`CACHE_DEFAULTS`）を検証する。

### public/private 出し分け（AC2/AC3/AC4）

ミドルウェアファクトリを 2 つ用意する（`server/src/middleware/cacheControl.ts`）。

- `createPublicCache(options)` — **GET かつ未認証**（`!req.isAuthenticated?.() && !req.user`）のときのみ public ヘッダを付与。それ以外（認証済み・非 GET）は `private, no-store` を付与する。さらに `Vary: Cookie` を付け、エッジ/ブラウザが Cookie 有無でキャッシュエントリを分離するよう促す（多層防御）。これを public 候補ルート群の手前に `app.use` でマウントする。
- `createNoStoreCache()` — 常に `private, no-store` を付与。auth/admin 系ルート群の手前にマウントする。

**実装方針の確定**: 「リクエストの認証有無で public/private を出し分ける」方式を採る。理由:
- 現状の public 候補 GET（feed/communities/post 取得）はレスポンス本文にユーザー個別データを含まない（vote 状態は別 API、購読状態は `/:slug/subscription` 専用エンドポイント）。しかし将来応答にユーザー別フィールドが乗る変更が入っても、**認証済み = private** を機械的に保証しておけば事故らない（安全側の既定）。
- レスポンスをユーザー別に分離する案は SPA 構造上不要（個別データは別エンドポイント）。出し分け方式が最小実装かつ安全。

`/api/communities/:slug/subscription`（#421・購読状態）は public 候補ルータ内にあるが、ユーザー個別データを返すため**ルータ単位ではなく当該ハンドラで** `private, no-store` を明示する。`createPublicCache` を `/api/communities` 全体に掛けると subscription も「未認証なら public」になってしまい、未認証でも `{subscribed:false}` という個別データ意味を持つ応答を public キャッシュするのは方針上望ましくないため、subscription ハンドラ内で no-store を上書きする。

### s-maxage 秒数の根拠（AC5）

vote 数のリアルタイム性は本プロダクトでは重要でない（観察エンタメ・定時更新）。一方コンテンツ自体は 1 日数回しか増えないため、エッジ滞留はオリジン負荷を大きく下げる。

- `s-maxage = 60`（エッジが 60 秒は再検証なしで配信）。vote の反映は最大 60 秒遅延を許容。
- `stale-while-revalidate = 300`（60 秒経過後も 5 分間は古い値を即返しつつバックグラウンド再検証）。ユーザー体感のレイテンシを保ちつつオリジン到達を間引く。

定時バッチ完了後の Cloudflare Cache Purge（ADR-0015）は本 Issue スコープ外。`stale-while-revalidate` で更新反映の許容範囲に収める。

### 非対象（スコープ外）

Cache Purge 連携・ETag/Last-Modified・Cloudflare Pages 静的アセットは対象外（Issue 補足のとおり）。

## テスト計画（TDD）

1. `config/security.cache.test.ts` — `CACHE_DEFAULTS` の既定値・`buildPublicCacheControl`/`buildPrivateCacheControl` の文字列。
2. `middleware/cacheControl.test.ts` — `createPublicCache`（未認証 GET=public / 認証済み=private / 非 GET=private / Vary:Cookie）・`createNoStoreCache`。
3. ルートテスト（supertest 経由・`createApp`）— public 候補 GET が未認証で public ヘッダを返す / 認証済みで private / private 必須ルートが no-store / subscription が no-store / 書き込み系が public を含まない / env 上書きが反映される。

## ユーザー可視の振る舞い

レスポンスヘッダの追加のみで、画面・遷移・操作結果は変わらない。e2e usecases の更新は不要（その旨 PR に明記）。
