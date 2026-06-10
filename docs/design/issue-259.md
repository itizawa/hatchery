# 設計書: robots.txt と sitemap.xml を追加してクローラーに公開ページを通知する (#259)

## 1. 目的 / 背景

ゲストアクセス（#255）で公開ページが生まれるため、検索エンジン・SNS クローラーに公開ページ／非公開ページを正しく通知する。

- `client/public/robots.txt` で非公開パス（`/admin`・`/account`・`/office`）をクロール対象外にし、`Sitemap:` で sitemap.xml の所在を示す。
- `GET /sitemap.xml`（server）でトップページと全チャンネル URL を動的列挙し、検索インデックス登録を促す。

## 2. スコープ（やること / やらないこと）

### やること
- `client/public/robots.txt`（静的）を追加。
- `server/src/routes/sitemap.ts` に `GET /sitemap.xml` を実装し、`createApp` で認証なしマウント。
- sitemap は `GET /api/communities` と同じ `communityRepository.list()` の結果から公開ページ URL を生成。`<lastmod>` は各 community の最終投稿日時（`lastSlotKey`）または `createdAt` を採用。

### モデルの読み替え（重要）

Issue #259 本文は旧 `channel` モデル（`GET /api/channels`・`/channels/:id`）を前提に書かれているが、現在の develop は ADR-0019〜0023 で **`community > post > comment`** モデルへ移行済みで、`channel`/`message` は撤去済み（`GET /api/channels` は存在しない）。Issue の意図（公開ページをクローラーに通知）に忠実に、現行の公開ページである **community（`GET /api/communities` / `/communities/:slug`）** を sitemap に列挙する形へ読み替える。robots.txt の Disallow（`/admin`・`/account`・`/office`）と `Sitemap:` ディレクティブは受け入れ条件どおり実装する。

### やらないこと
- Google Search Console 登録・確認ファイル（運用作業・別途）。
- SEO のさらなる最適化（Phase 2 以降）。
- robots.txt の動的生成（静的 `public/robots.txt` で十分）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `client/public/robots.txt` が存在し、
   - `User-agent: *` に対し `/admin`・`/account`・`/office` の `Disallow` を含む。
   - `Sitemap:` ディレクティブで本番 sitemap.xml の絶対 URL を含む。
2. `GET /sitemap.xml` が 200 を返し、
   - トップページ URL（`<base>/`）を含む。
   - `communityRepository.list()` の各 community について `<base>/communities/<slug>` を含む。
   - 各 community に `<lastmod>`（ISO8601）を含む（`lastSlotKey` 優先、無ければ `createdAt`）。
3. `GET /sitemap.xml` は `requireAuth` なし（未認証でも 200）。
4. レスポンスの `Content-Type` が `application/xml` を含む。
5. `pnpm turbo run build test lint` 緑。`server → common` の一方向 import 境界を遵守。

## 4. 設計方針

- **ベース URL**: 環境変数 `PUBLIC_BASE_URL`（未設定時の既定値は本番フロント URL）を `loadEnv` で読み、`createApp` の `SecurityOptions` ではなく専用の `publicBaseUrl` として注入する。テストではデフォルト値で検証。
- **ルータ**: `createSitemapRouter(communityRepository, baseUrl)` を新設。`GET /` で XML を組み立て、`res.type("application/xml")` で返す。`requireAuth` は付けない。
- **lastmod**: 各 community の `lastSlotKey`（最終投稿スロット・`YYYY-MM-DDTHH:mm` 形式）を Date に解釈して `<lastmod>` に使う。無ければ `createdAt`。
- **XML 生成**: 外部ライブラリを足さず、文字列テンプレートで `<urlset>` を生成。URL とテキストは XML エスケープする。
- **robots.txt**: `client/public/` を新設し静的ファイルとして置く（Vite が本番 `/robots.txt` に配置）。

## 5. 影響範囲 / 既存への変更

- `server/`:
  - 新規 `server/src/routes/sitemap.ts`・`server/src/routes/sitemap.test.ts`。
  - `server/src/app.ts`: `AppDeps` に `publicBaseUrl?: string` を追加し `app.use("/sitemap.xml", createSitemapRouter(communityRepo, publicBaseUrl))` をマウント。
  - `server/src/config/env.ts`: `PUBLIC_BASE_URL` を追加（既定 `https://hatchery.pages.dev`）。
  - `server/src/server.ts`: env から `publicBaseUrl` を `createApp` に渡す。
- `client/`: 新規 `client/public/robots.txt`。
- `common/`: 変更なし。

## 6. テスト計画（TDD）

- `server/src/routes/sitemap.test.ts`:
  - 未認証で 200 を返す。
  - `Content-Type` が `application/xml`。
  - トップページ URL を含む。
  - 注入した community の `/communities/<slug>` URL を含む。
  - `lastSlotKey` があれば `<lastmod>` にそれを反映、無ければ `createdAt` を反映。
- robots.txt の内容検証（`client` 側 or リポジトリテスト）: `/admin`・`/account`・`/office` の Disallow と `Sitemap:` 行を含む。client の vitest で `client/public/robots.txt` を読んで検証する。

## 7. リスク・未決事項

- 本番ドメインの既定値は `DEFAULT_OGP_URL`（client/vite.config.ts）と同じ `https://hatchery.pages.dev` に合わせる。運用時は `PUBLIC_BASE_URL` で上書き。
- Issue 本文は旧 channel モデル前提だが、現行モデル（community）に読み替えて実装する（§2「モデルの読み替え」）。
