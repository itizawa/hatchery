# Issue #515 設計書: 投稿・コメント本文の OGP カード展開

## 概要

投稿(post)・コメント(comment)の本文に含まれる URL を自動でリンク化し、先頭 URL について
OGP カード（タイトル・説明・サムネイル・サイト名）を展開表示する機能を追加する。

## 受け入れ条件の整理

1. **本文の自動リンク化（client）**: PostCard / CommentCard で URL を `<a>` リンクに変換する
2. **OGP 取得プロキシ（server）**: `GET /api/ogp?url=<url>` で OGP メタデータを取得して返す
3. **OGP カード描画（client）**: 先頭 URL の OGP を TanStack Query 経由で取得し、カードとして表示する
4. **層・境界の遵守**: URL 抽出 / OGP メタ抽出の純粋ロジックは `common` に置く
5. **テスト**: URL 抽出・OGP メタ抽出・SSRF 判定の純粋ロジックを Vitest でカバー

## 実装方針

### common 側（環境非依存の純粋ロジック）

`common/src/logic/ogp.ts`:
- `extractFirstUrl(text: string): string | null` — テキストから先頭の http(s):// URL を抽出
- `extractOgpFromHtml(html: string): OgpMeta` — HTML 文字列から OGP メタを抽出（純粋関数）
  - og:title, og:description, og:image, og:site_name を抽出
  - og:title が無ければ `<title>` タグにフォールバック

`common/src/domain/ogp/ogp.ts`:
- `OgpUrlQuerySchema` — `url` クエリパラメータの Zod スキーマ（`.url().max(2048)` + http/https のみ）
- `OgpMetaSchema` — レスポンス型の Zod スキーマ（title/description/image/site_name すべて optional）

### server 側

`server/src/routes/ogp.ts`:
- `GET /api/ogp?url=<url>` エンドポイント
- SSRF ガード: プライベート IP・localhost・非 http(s) を拒否
- `fetch` で対象 URL の HTML を取得（タイムアウト 5 秒・レスポンス最大 512KB）
- common の `extractOgpFromHtml` でメタ抽出して返す
- 取得失敗・非 HTML の場合は `{ title: null, description: null, image: null, site_name: null }` を返す

SSRF ガードのロジック:
- URL の hostname を DNS 解決せず直接文字列レベルでチェック（正規表現）
- 対象: `localhost`, `127.x.x.x`, `10.x.x.x`, `172.16-31.x.x`, `192.168.x.x`, `169.254.x.x`, `::1`, `0.0.0.0`

OpenAPI 登録: `server/src/openapi/registrations/registerOgp.ts`
- `GET /api/ogp` パスを registry に追加

`server/src/app.ts`:
- `/api/ogp` ルートを `publicCache` でマウント
- `registry.ts` で `registerOgp` を呼ぶ

### client 側

`client/src/api/ogp.ts`:
- `fetchOgp(url: string)` — `openApiClient` 経由で `GET /api/ogp?url=<url>` を呼ぶ
- TanStack Query hook `useOgp(url: string | null)` を同ファイルに定義

`client/src/components/TextWithLinks.tsx`:
- テキストを URL と非 URL に分割してレンダリング
- URL 部分を `<a target="_blank" rel="noopener noreferrer">` でラップ
- 生 HTML 注入は使わず React 要素として組み立てる（XSS 防止）

`client/src/components/OgpCard.tsx`:
- `url` prop を受け取り `useOgp` で OGP を取得
- 取得成功時: タイトル・説明・サムネイル・サイト名を MUI Card で表示
- 取得中: 表示しない（スケルトン不要）
- 取得失敗 or OGP なし: 何も表示しない（リンク表示のみにフォールバック）

`PostCard.tsx` / `CommentCard.tsx` の改修:
- `<Typography>{post.text}</Typography>` → `<TextWithLinks text={post.text} />`
- 本文直後に `<OgpCard url={firstUrl} />` を追加（firstUrl は `extractFirstUrl` で取得）

## OGP 取得タイミングの設計判断

Issue の指定通り「閲覧時にサーバプロキシで遅延取得」方式を採用。
- バッチ事前取得・DB 保存はスコープ外
- 短期インメモリキャッシュは任意とする（今回は実装しない）

## SSRF ガード詳細

以下のホストへのフェッチを拒否する（文字列マッチ）:
- `localhost`
- `127.x.x.x` (`/^127\./`)
- `10.x.x.x` (`/^10\./`)
- `172.16-31.x.x` (`/^172\.(1[6-9]|2\d|3[01])\./`)
- `192.168.x.x` (`/^192\.168\./`)
- `169.254.x.x` (`/^169\.254\./`)
- `0.0.0.0`
- `::1`

## テスト計画（TDD）

### common テスト

`common/src/logic/ogp.test.ts`:
- `extractFirstUrl`: テキストから先頭 URL を抽出する / URL なし → null / 複数 URL → 先頭のみ
- `extractOgpFromHtml`: og:title/description/image/site_name を抽出する / フォールバック確認

`common/src/domain/ogp/ogp.test.ts`:
- `OgpUrlQuerySchema`: 有効 URL は通る / 2048 文字超えは reject / http/https 以外は reject

### server テスト

`server/src/routes/ogp.test.ts`:
- 有効 URL で OGP メタが返る（fetch をモック）
- プライベート IP は 400 で拒否される
- localhost は 400 で拒否される
- フェッチ失敗時は OGP 空を返す

## ファイル構成

```
common/src/
  domain/ogp/
    ogp.ts             (新規: Zod スキーマ)
    ogp.test.ts        (新規: スキーマのテスト)
    index.ts           (新規: export)
  logic/
    ogp.ts             (新規: extractFirstUrl / extractOgpFromHtml)
    ogp.test.ts        (新規: ロジックのテスト)

server/src/
  routes/
    ogp.ts             (新規: GET /api/ogp)
    ogp.test.ts        (新規: ルートのテスト)
  openapi/registrations/
    registerOgp.ts     (新規: OpenAPI 登録)
  app.ts               (変更: /api/ogp ルートを追加)
  openapi/registry.ts  (変更: registerOgp を呼ぶ)

client/src/
  components/
    TextWithLinks.tsx  (新規: URL をリンク化するコンポーネント)
    OgpCard.tsx        (新規: OGP カード表示コンポーネント)
    PostCard.tsx       (変更: TextWithLinks + OgpCard を使用)
    CommentCard.tsx    (変更: TextWithLinks + OgpCard を使用)
  api/
    ogp.ts             (新規: fetchOgp + useOgp hook)
```
