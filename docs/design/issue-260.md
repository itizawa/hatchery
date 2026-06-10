# 設計書: Cloudflare Pages Functions + HTMLRewriter でチャンネル別 OGP を動的生成する (#260)

## 1. 目的 / 背景

ADR-0008 / ADR-0015 で「ページ毎 OGP は Cloudflare Pages Functions + `HTMLRewriter` でエッジ後付けする（SSR/Next.js 移行はしない）」と決定済み。SNS にチャンネル URL（`/channels/:id`）をシェアしたとき、クローラ（JS 非実行）に対してそのチャンネル名・説明を反映した OGP プレビューを返せるようにする。通常ユーザーへの配信は SPA のまま変更しない。

既存の `client/functions/_middleware.ts`（Basic 認証）と同じ Cloudflare Pages Functions 基盤の上に、`/channels/:id` 専用の Function を追加する。

## 2. スコープ（やること / やらないこと）

### やること
- `client/functions/channels/[id].ts`（Pages Functions の動的ルート）で `/channels/:id` をインターセプト。
- クローラ判定（User-Agent に `bot` / `Twitterbot` / `Slackbot` / `facebookexternalhit` 等を含む）。
- クローラに対し `GET /api/channels` からチャンネル一覧を取得し、`:id` 一致のチャンネル名で `index.html` の OGP `<meta>`（`og:title` / `og:description` / `og:url`）を `HTMLRewriter` で書き換えて返す。
- 通常ブラウザ・未知 channelId・API 失敗時はフォールバック（未改変の `index.html` = 共通 OGP）を返す。
- ロジック中核を純粋関数に切り出して Vitest（node 環境）でテストする。

### やらないこと
- `og:image` のチャンネル別動的生成（別 Issue・スコープ外）。
- Next.js / SSR / SSG 移行（ADR-0003 / ADR-0008 上不採用）。
- index.html への共通 OGP メタタグの追加（別 Issue の責務。本 Function は存在すれば書き換え、無ければそのまま返す＝フォールバック動作）。
- 認証付き非公開チャンネルの扱い（`GET /api/channels` は認証不要の公開一覧）。

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `client/functions/channels/[id].ts` が存在し、`/channels/:id` への GET をインターセプトする Pages Function（`onRequest`）をエクスポートする。
2. `isCrawler(userAgent)` が `bot` / `Twitterbot` / `Slackbot` / `facebookexternalhit` / `Discordbot` 等を含む UA（大文字小文字無視）で `true`、通常ブラウザ UA で `false` を返す。
3. `buildOgpMeta({ channel, requestUrl })` が以下を返す:
   - `title` = `<label> - Hatchery`
   - `description` = チャンネル説明（label を含む固定フォーマット文）
   - `url` = リクエスト URL
4. `findChannelInList(channels, id)` が一覧から id 一致のチャンネルを返し、未一致なら `undefined`。
5. `resolveApiBase(env, requestUrl)` が `env.API_BASE_URL` を優先し、未設定なら同一オリジンを返す（`/api/channels` を組み立てるための base）。
6. クローラ UA + 既知 channelId → `og:title` / `og:description` / `og:url` を書き換えた HTML が返る（HTMLRewriter 経由、ステータス 200）。
7. 通常ブラウザ UA → `next()`（未改変の SPA）を返す。
8. 未知 channelId（一覧に無い）→ フォールバック（`next()`）を返す。
9. `GET /api/channels` がエラー/非 200 → フォールバック（`next()`）を返す。
10. Pages Function のローカルテスト方法を本設計書（§ ローカルテスト方法）に記載する。
11. `pnpm turbo run build test lint`（または各ワークスペースの test/lint）が緑。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- **動的ルート**: Cloudflare Pages Functions の `functions/channels/[id].ts` は `/channels/:id` にマッチし、`context.params.id` で channelId を取得できる。`_middleware.ts`（Basic 認証）が先に実行され、その後この Function が走る。
- **純粋関数の分離（テスト容易性）**: HTMLRewriter は Workers ランタイム専用で node/jsdom には無い。そこでロジックの中核を依存のない純粋関数に切り出し、これを Vitest（node 環境）でテストする:
  - `isCrawler(userAgent: string | null): boolean`
  - `findChannelInList(channels, id): ChannelLike | undefined`
  - `buildOgpMeta({ channel, requestUrl }): { title; description; url }`
  - `resolveApiBase(env, requestUrl): string`
  - `escapeHtmlAttr(value): string`（属性値の `"` `&` `<` `>` をエスケープして注入を防ぐ）
- **OGP 注入の方式**: `HTMLRewriter` で `<head>` の末尾に `og:title` / `og:description` / `og:url` の `<meta property=...>` を **append** する（`head` 要素ハンドラの `element.append(html, { html: true })`）。既存の共通 OGP がある場合は重複し得るが、クローラは後勝ち/最初勝ちが実装依存のため、本 Issue では「append でチャンネル別 OGP を確実に存在させる」方針とする（フォールバック時のみ何もしない）。属性値はエスケープ済み。
- **API 取得**: `fetch(\`${apiBase}/api/channels\`)`。`apiBase` は `env.API_BASE_URL`（Cloudflare Pages の Functions 環境変数バインディング）優先、未設定時はリクエストの同一オリジン。非 200 や例外時はフォールバック。
- **フォールバック**: クローラでない / channel 未発見 / API 失敗のいずれも `context.next()`（= SPA の素の index.html）を返す。これにより既存動作を維持し、共通 OGP（別 Issue で追加）がそのまま使われる。

### チャンネル説明（og:description）
共通 OGP との差別化として、固定フォーマット `「<label>」チャンネルでの AI ワーカーたちの会話を観察しよう。 | Hatchery` を用いる。チャンネルに専用説明フィールドは無い（`Channel` は id/label/type/goal のみ）ため label ベースの説明文を生成する。

## 5. 影響範囲 / 既存への変更（対象ワークスペース）

- **client** のみ:
  - 新規 `client/functions/channels/[id].ts`（Pages Function 本体）
  - 新規 `client/functions/channels/ogp.ts`（純粋関数群）
  - 新規 `client/functions/channels/ogp.test.ts`（Vitest）
- server / common / docs（Storybook）への変更なし。`GET /api/channels` は既存の公開エンドポイントをそのまま利用。

## 6. テスト計画（TDD で書くテスト一覧）

`client/functions/channels/ogp.test.ts`（`// @vitest-environment node`）:
- `isCrawler`: Twitterbot / Slackbot / facebookexternalhit / Discordbot / 一般 `bot` を含む UA で true、Chrome/Safari UA で false、null/空で false。
- `findChannelInList`: 一致で該当 channel、未一致で undefined、空配列で undefined。
- `buildOgpMeta`: title = `<label> - Hatchery`、description に label を含む、url = 渡した requestUrl。
- `resolveApiBase`: `env.API_BASE_URL` 設定時はそれ、未設定時はリクエスト origin。
- `escapeHtmlAttr`: `"`, `&`, `<`, `>` をエスケープする。

> 注: `HTMLRewriter` 自体は Workers 専用 API で node テスト環境に存在しないため、`onRequest` の HTMLRewriter 経路は純粋関数の単体テストとローカル `wrangler pages dev` 手動確認でカバーする（受け入れ条件 §3 の方針）。

## ローカルテスト方法（受け入れ条件 6）

1. client をビルド: `pnpm --filter @hatchery/client build`（出力 `client/dist/web`）。
2. Cloudflare Pages の Functions を含むローカルサーバを起動:
   ```
   cd client
   pnpm wrangler pages dev dist/web
   ```
   （`functions/` ディレクトリが自動で読み込まれる。`wrangler.toml` の `pages_build_output_dir = dist/web` に対応。）
3. クローラ UA を装って `/channels/zatsudan` を取得し、OGP が書き換わるか確認:
   ```
   curl -s -A "Twitterbot/1.0" http://localhost:8788/channels/zatsudan | grep 'og:'
   ```
   → `og:title` に「雑談 - Hatchery」等が含まれること。
4. 通常 UA では未改変であることを確認:
   ```
   curl -s -A "Mozilla/5.0" http://localhost:8788/channels/zatsudan | grep 'og:'
   ```
   → チャンネル別 og メタが追加されないこと（共通 OGP のみ）。
5. API ベース URL を別オリジンにする場合は `--binding API_BASE_URL=https://<cloud-run-url>` を `wrangler pages dev` に付与する。
   本番（GitHub Actions デプロイ）では Cloudflare Pages の環境変数 `API_BASE_URL` に Cloud Run の URL を設定する。

ユニットテスト: `pnpm --filter @hatchery/client test`（`functions/**/*.test.ts` を含む）。

## 7. リスク・未決事項

- `HTMLRewriter` 経路は node 単体テストで直接検証できない（Workers ランタイム専用）。純粋関数の網羅 + `wrangler pages dev` 手動確認で担保する。
- 共通 OGP（index.html の `<meta>`）は別 Issue 管轄。未追加でも本 Function は append により og メタを注入でき、フォールバック時は素の index.html を返す（破綻しない）。
- `API_BASE_URL` バインディングはデプロイ設定（Cloudflare Pages 環境変数）に依存。未設定時は同一オリジン `/api/channels` を叩く（クロスオリジン構成では 404 になりフォールバックする）。デプロイ設定は別途運用で付与する。
