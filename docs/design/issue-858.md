# 設計書: 投稿詳細・コミュニティページを Cloudflare Pages Functions で OGP / SEO 対応する (#858)

## 1. 目的 / 背景

ADR-0015 で「OGP/SEO は Cloudflare Pages Functions + HTMLRewriter で実現する」と決定済み。ADR-0018 でプロダクトが Reddit 風コミュニティ + 投稿モデルに移行したが、Pages Function は旧チャンネルモデル向け（`client/functions/channels/`）のままで、投稿詳細（`/posts/:id`）・コミュニティ（`/communities/:slug`）には OGP が未実装。SNS クローラーに空 HTML が返る状態を解消する。

## 2. スコープ（やること / やらないこと）

### やること
- `client/functions/channels/` を削除（旧モデルの死んだコード）
- 共有ユーティリティを `client/functions/shared/ogp.ts` に抽出
- 投稿詳細の OGP Pages Function（`client/functions/posts/[id].ts` + `ogp.ts`）を新規作成
- コミュニティの OGP Pages Function（`client/functions/communities/[id].ts` + `ogp.ts`）を新規作成
- ADR-0015 に補足注記を追記

### やらないこと
- エッジ SSR（本文 HTML 注入）
- Cache Purge（別 Issue）
- robots.txt / sitemap.xml
- og:image の生成

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `client/functions/channels/` が削除されている
2. `client/functions/shared/ogp.ts` に `isCrawler`・`resolveApiBase`・`escapeHtmlAttr`・`buildOgpMetaHtml`・型（`OgpMeta`・`OgpEnv`・`PagesContext`）が存在し、テスト済み
3. `buildPostOgpMeta({ post, requestUrl })` が `{ title: "<投稿タイトル> - Hatchery", description: 投稿本文冒頭100文字, url: requestUrl }` を返す
4. `client/functions/posts/[id].ts` がクローラーに対して `GET /api/posts/:id` を fetch し、OGP meta タグを HTMLRewriter で注入する。非クローラー・失敗時は `next()` にフォールバック
5. `buildCommunityOgpMeta({ community, requestUrl })` が `{ title: "<コミュニティ名> - Hatchery", description: コミュニティの description（200文字切り捨て）, url: requestUrl }` を返す
6. `client/functions/communities/[id].ts` がクローラーに対して `GET /api/communities` を fetch し、`params.id` に slug 一致するコミュニティを探し、OGP meta タグを注入する。非クローラー・未一致・失敗時は `next()`
7. ADR-0015 に注記が追記されている
8. `pnpm turbo run build test lint` が緑

## 4. 設計方針

### 共有モジュール抽出
`channels/ogp.ts` の汎用関数（`isCrawler`・`resolveApiBase`・`escapeHtmlAttr`・`buildOgpMetaHtml`・型定義）を `shared/ogp.ts` に移動。各ドメイン（posts/communities）の `ogp.ts` はドメイン固有の `buildXxxOgpMeta` のみを持ち、共有モジュールを import する。

### API フェッチ戦略
- 投稿: `GET /api/posts/:postId` — 単一リソース取得（レスポンスの `post` フィールドから `title`・`text` を使用）
- コミュニティ: `GET /api/communities` — 一覧取得 → `slug` で filter（単一取得 API が未実装のため。チャンネル実装と同パターン）

### URL マッピング
- `/posts/:id` → `client/functions/posts/[id].ts`（`params.id` = postId）
- `/communities/:slug` → `client/functions/communities/[id].ts`（`params.id` = slug）

## 5. 影響範囲 / 既存への変更

- **client**: `functions/channels/` 削除、`functions/shared/` 新設、`functions/posts/` 新設、`functions/communities/` 新設
- **server**: 変更なし
- **common**: 変更なし
- **docs**: ADR-0015 に注記追記

## 6. テスト計画（TDD で書くテスト一覧）

1. `client/functions/shared/ogp.test.ts` — `isCrawler`・`resolveApiBase`・`escapeHtmlAttr`・`buildOgpMetaHtml` のテスト（channels/ogp.test.ts から移動・拡充）
2. `client/functions/posts/ogp.test.ts` — `buildPostOgpMeta` のテスト（タイトルフォーマット、description の 100 文字切り捨て、URL 保持）
3. `client/functions/communities/ogp.test.ts` — `buildCommunityOgpMeta` のテスト（タイトルフォーマット、description の 200 文字切り捨て、URL 保持）

## 7. リスク・未決事項

- `GET /api/communities` が全件返すため、コミュニティ数が増えるとレスポンスが大きくなる。将来的に `GET /api/communities/:slug` 単一取得 API を追加すべき（別 Issue）。
- og:image は今回スコープ外。投稿・コミュニティの画像が欲しい場合は別途対応。
