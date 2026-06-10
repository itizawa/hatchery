# 設計書: index.html に OGP 共通メタタグを追加しシェア時のプレビューを改善する (#256)

## 1. 目的 / 背景

現在の `client/index.html` は `<title>Hatchery</title>` のみで OGP タグが無く、SNS（X / Slack / Discord 等）で
URL をシェアしてもプレビューカード（タイトル・説明・サムネ）が出ない。ADR-0008 の方針「MVP 段階は
`index.html` 共通 OGP で十分」に沿って、共通 OGP メタタグを `index.html` に静的に追加する。
あわせて、コミュニティ詳細ページではブラウザタブのタイトルをコミュニティ名で動的更新し、ブックマーク・
タブ管理を使いやすくする。

> Issue 本文は channel→community のリネーム（ADR-0018〜）前に起票されており、`ChannelScene.tsx` /
> `/channels/$channelId` という旧名で書かれている。現行コードベースでは詳細ページは
> `CommunityScene.tsx`（`/communities/$slug`）であるため、動的タイトル更新はそこに実装する
> （受け入れ条件 3 を「コミュニティ詳細ページ」と読み替える）。

## 2. スコープ（やること / やらないこと）

### やること

- `client/index.html` の `<head>` に共通 OGP メタタグ（`og:title` / `og:description` / `og:type` /
  `og:url` / `og:image` / `twitter:card`）と `<meta name="description">` を追加。`<html lang="ja">` は維持。
- `og:url` はビルド時に環境変数（`VITE_OGP_URL`）で注入できるようにする（Vite の `%VITE_*%` HTML 置換）。
  既定値はコミット済み `client/.env` に置く。
- OGP 用静的画像 `client/public/ogp.svg` を新規配置し、`client/public/` ディレクトリを新設する。
- コミュニティ詳細ページ（`CommunityScene`）で `document.title` を `<コミュニティ名> - Hatchery` 形式に
  動的更新する。再利用可能な `useDocumentTitle` フックとして実装し、TDD でテストする。

### やらないこと

- クローラ向けのチャンネル別 OGP 動的書き換え（Cloudflare Pages Functions + HTMLRewriter）。別 Issue（ADR-0008）。
- 動的 OGP 画像生成。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `client/index.html` の `<head>` に以下の静的メタタグが存在する。
   - `og:title` = `Hatchery`
   - `og:description`（サービス説明文）
   - `og:type` = `website`
   - `og:url`（`%VITE_OGP_URL%` で注入。`client/.env` の既定値が本番ドメイン）
   - `og:image`（`/ogp.svg` 等 `public/` 配下の静的画像）
   - `twitter:card` = `summary_large_image`
2. `client/index.html` に `<html lang="ja">` が維持され、`<meta name="description">` が追加されている。
3. `useDocumentTitle(title)` フックが `document.title` を引数の値に設定する。空文字/undefined の場合は
   既定タイトル（`Hatchery`）にフォールバックする。
4. `CommunityScene` を `/communities/$slug` で描画したとき、コミュニティ名が取得できれば
   `document.title` が `<コミュニティ名> - Hatchery` になる。コミュニティ未取得時は `Hatchery`。
5. `client/public/ogp.svg`（OGP 画像）が存在する。
6. `pnpm turbo run build test lint`（client）が緑。

## 4. 設計方針

- **静的 OGP**: `index.html` に直接メタタグを書く。`og:url` のみ環境差し替えが必要なため Vite の
  HTML 環境変数置換 `%VITE_OGP_URL%` を使う。Vite は `.env` を自動ロードし `VITE_*` を HTML に展開する。
  既定値は本番想定ドメインを `client/.env`（コミット）に置き、`.env.example` にも記載する。
- **動的タイトル**: `client/src/hooks/useDocumentTitle.ts` に純粋な副作用フックを実装。
  `useEffect` で `document.title` を設定。引数が空なら `Hatchery` 既定にフォールバック。
  アンマウント時に既定タイトルへ戻す（他ページへ遷移したときにコミュニティ名が残らないように）。
  `CommunityScene` から `community?.name` を渡して利用する。
- **OGP 画像**: 軽量な SVG（`client/public/ogp.svg`）をプレースホルダとして配置。Vite は `public/`
  をルート配信するため `/ogp.svg` で参照できる。

## 5. 影響範囲 / 既存への変更

- `client/index.html`（OGP メタタグ追加）
- `client/.env`（新規・`VITE_OGP_URL` 既定値）、`client/.env.example`（追記）
- `client/public/ogp.svg`（新規）
- `client/src/hooks/useDocumentTitle.ts`（新規）+ `useDocumentTitle.test.ts`（新規）
- `client/src/routes/CommunityScene.tsx`（フック呼び出し追加）
- 対象ワークスペース: client のみ。server / common / docs（ADR）への変更なし。

## 6. テスト計画（TDD で書くテスト）

- `useDocumentTitle.test.ts`
  - 文字列を渡すと `document.title` がその値になる。
  - 空文字 / undefined を渡すと `document.title` が既定（`Hatchery`）になる。
  - アンマウント後 `document.title` が既定（`Hatchery`）に戻る。
- `CommunityScene` のタイトル更新は `useDocumentTitle` のユニットテストでカバー（ルータ統合テストは
  既存パターンが重く、フック単体で受け入れ条件を満たすため最小構成とする）。
- index.html のメタタグはマークアップの静的確認（テキスト一致テスト）で検証する。

## 7. リスク・未決事項

- `og:url` は SPA のため全 URL 同一（共通 OGP）。ページ別 OGP はスコープ外（ADR-0008）。
- 本番ドメインが未確定の場合、`VITE_OGP_URL` の既定値は暫定値とし、デプロイ時に上書きする想定。
