# 設計書: OGP meta タグ重複解消 (#1020)

## 1. 目的 / 背景

`client/functions/posts/[id].ts` / `client/functions/communities/[id].ts` の Cloudflare Pages Function が、クローラ向けにレスポンス HTML へ動的 OGP meta タグを `element.append()` で追記している。しかし `index.html` に既に静的な `og:title`・`og:description`・`og:url`・`twitter:title`・`twitter:description` が存在するため、同一 property の `<meta>` タグが2つ重複する。多くの SNS クローラは先頭タグを採用するため、静的デフォルト「Hatchery」が SNS シェアカードに表示され、投稿/コミュニティ固有のタイトル・説明文が無視される問題が発生している。

## 2. スコープ（やること / やらないこと）

**やること:**
- `[id].ts` 2ファイルで HTMLRewriter の `append` 方式を「既存 OGP タグを remove してから append」方式へ変更
- 除去すべきセレクタ定数 `OGP_META_SELECTORS_TO_REMOVE` を `shared/ogp.ts` に追加してエクスポート
- `posts/[id].test.ts` / `communities/[id].test.ts` を新設し、重複解消の振る舞いをテスト

**やらないこと:**
- `og:type`・`og:image`・`twitter:card` の除去（`buildOgpMetaHtml` が上書きしないため競合しない）
- ワーカープロフィールページ（`/workers/:id`）の OGP 対応（スコープ外）

## 3. 受け入れ条件（テストに落とせる粒度）

1. `OGP_META_SELECTORS_TO_REMOVE` が `buildOgpMetaHtml` が生成する全プロパティ/名前と 1:1 対応している
2. 投稿ページで、既存 OGP タグを含む HTML に変換を適用すると `og:title` / `og:description` / `og:url` / `twitter:title` / `twitter:description` が各1つのみ存在する
3. コミュニティページで同様に重複が解消される
4. 非クローラの場合は `next()` をそのまま返し変換を適用しない
5. `pnpm turbo run build|test|lint` が緑

## 4. 設計方針

### 除去セレクタの集約

`buildOgpMetaHtml` が生成する5プロパティに対応するセレクタを `shared/ogp.ts` に定数としてエクスポートする。

```typescript
export const OGP_META_SELECTORS_TO_REMOVE = [
  'meta[property="og:title"]',
  'meta[property="og:description"]',
  'meta[property="og:url"]',
  'meta[name="twitter:title"]',
  'meta[name="twitter:description"]',
] as const;
```

### HTMLRewriter の変更パターン

```typescript
// Before (append のみ)
new HTMLRewriter()
  .on("head", { element(el) { el.append(metaHtml, { html: true }); } })
  .transform(response)

// After (remove してから append)
new HTMLRewriter()
  .on(OGP_META_SELECTORS_TO_REMOVE[0], { element(el) { el.remove(); } })
  .on(OGP_META_SELECTORS_TO_REMOVE[1], { element(el) { el.remove(); } })
  .on(OGP_META_SELECTORS_TO_REMOVE[2], { element(el) { el.remove(); } })
  .on(OGP_META_SELECTORS_TO_REMOVE[3], { element(el) { el.remove(); } })
  .on(OGP_META_SELECTORS_TO_REMOVE[4], { element(el) { el.remove(); } })
  .on("head", { element(el) { el.append(metaHtml, { html: true }); } })
  .transform(response);
```

### テスト戦略

`HTMLRewriter` は Cloudflare Workers 固有 API でありテスト環境 (Vitest/Node.js) では利用不可のため、`vi.stubGlobal` で HTML テキスト処理ベースのモックを提供する。モックは `[id].ts` ファイルと同じ構造を持つ `on()` + `transform()` を実装し、HTML 文字列に対して attribute セレクタを regex で適用することで挙動を再現する。

## 5. 影響範囲 / 既存への変更

| ファイル | 変更内容 |
|---------|----------|
| `client/functions/shared/ogp.ts` | `OGP_META_SELECTORS_TO_REMOVE` 定数を追加 |
| `client/functions/posts/[id].ts` | HTMLRewriter を remove+append パターンに変更 |
| `client/functions/communities/[id].ts` | 同上 |
| `client/functions/shared/ogp.test.ts` | `OGP_META_SELECTORS_TO_REMOVE` の整合性テストを追加 |
| `client/functions/posts/[id].test.ts` | 新設：重複解消テスト |
| `client/functions/communities/[id].test.ts` | 新設：重複解消テスト |

## 6. テスト計画（TDD で書くテスト一覧）

### `shared/ogp.test.ts` への追加
- `OGP_META_SELECTORS_TO_REMOVE` が `buildOgpMetaHtml` の出力プロパティと 1:1 対応すること

### `posts/[id].test.ts`（新設）
- 非クローラ UA → `next()` をそのまま返す
- クローラ UA・投稿取得失敗 → `next()` をそのまま返す
- クローラ UA・投稿取得成功・既存 OGP タグあり → 動的 OGP タグのみ（重複なし）
- クローラ UA・投稿取得成功 → `og:title` が投稿タイトルを含む

### `communities/[id].test.ts`（新設）
- 非クローラ UA → `next()` をそのまま返す
- クローラ UA・コミュニティ取得失敗 → `next()` をそのまま返す
- クローラ UA・コミュニティ取得成功・既存 OGP タグあり → 動的 OGP タグのみ（重複なし）
- クローラ UA・コミュニティ取得成功・slug 不一致 → `next()` をそのまま返す

## 7. リスク・未決事項

- `og:type`・`og:image`・`twitter:card` は除去しないため、これらの静的デフォルト値はそのまま残る（意図した動作）。
- HTMLRewriter モックは CSS attribute セレクタを regex で再現するため、属性の順番に依存しない書き方が必要（`<meta content="..." property="og:title">` のような順序でも動作する）。
