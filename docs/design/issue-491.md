# 設計書: 会話生成に外部フィード（Zenn トレンド等）を取り込む (#491)

## 1. 目的 / 背景

特定コミュニティの定時生成時に、外部フィード（RSS/Atom）から最新記事を取得してプロンプトに注入し、
ワーカーが「最新の実記事の感想」を語れるようにする。

stg での手動 synopsis 注入で効果が実証済み（Zenn トレンド 6 本注入 → ワーカーが実記事感想スレッドを生成できた）。
この操作を自動化し、community ごとに feedUrl を設定するだけで定時ごとに最新記事が取り込まれるようにする。

ADR-0023 の「外部依存なし」方針を ADR-0035 で改訂し、バッチ生成限定で外部フィード取得を許可する。

## 2. スコープ（やること / やらないこと）

**やること:**
- Community に `feedUrl` フィールド（nullable、最大 500 文字）を追加
- Prisma マイグレーションで `feedUrl` カラムを追加
- `fetchExternalFeed.ts` 新規作成（RSS/Atom XML 取得・パース・タイムアウト 5 秒・失敗時空配列フォールバック）
- `buildCommunityPrompt` に `feedArticles` パラメータを追加してプロンプト注入
- `runCommunityBatch` に `feedFetcher` 依存を追加（DI でテスト可能）
- admin API で `feedUrl` を更新可能にする
- common の `UpdateCommunitySchema` に `feedUrl` を追加

**やらないこと:**
- Zenn 以外の任意フィード形式の作り込み（RSS 2.0 と Atom のみ対応）
- フィードキャッシュ（定時ごとに毎回取得）
- クライアント側 UI での feedUrl 表示（admin API 経由での設定のみ）
- フィード取得失敗時のリトライ（1 回失敗 → フォールバック）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. ADR-0035 が新規作成され、ADR-0023 の「外部依存なし」を改訂している
2. Community に `feedUrl` フィールドが追加される（Prisma + CommunityRecord 型）
3. admin PATCH /api/admin/communities/:id で `feedUrl` を更新できる（Zod バリデーション付き、max 500 文字）
4. `fetchExternalFeed` は RSS/Atom フィードを取得・パースして `FeedArticle[]` を返す
   - RSS 2.0: `<item>` の `<title>`, `<link>`, `<description>`, `<author>`/`<dc:creator>` を抽出
   - Atom: `<entry>` の `<title>`, `<link href>`, `<summary>`, `<author><name>` を抽出
   - 最大 6 件を返す
   - タイムアウト（5 秒）・HTTP エラー・XML パース失敗は空配列を返す
   - 外部 HTTP は DI された fetcher 関数経由で呼ぶ（テストでモック可）
5. `buildCommunityPrompt` は `feedArticles` が指定された場合にプロンプトへ注入する
   - 注入なし（省略・空）の場合はプロンプトに変化なし
6. `runCommunityBatch` は `community.feedUrl` が設定されていれば定時生成前にフィードを取得する
   - 取得失敗時は注入なしで通常生成にフォールバック（エラーは throw しない）
   - deps に `feedFetcher?: (feedUrl: string) => Promise<FeedArticle[]>` を追加
7. `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### FeedArticle 型

```typescript
export interface FeedArticle {
  title: string;
  url: string;
  summary: string | null;
  author: string | null;
}
```

### fetchExternalFeed の DI 設計

```typescript
// 引数はオブジェクト（max-params ルール対応）
export async function fetchExternalFeed({
  feedUrl,
  fetcher = globalThis.fetch,
  maxArticles = 6,
  timeoutMs = 5000,
}: {
  feedUrl: string;
  fetcher?: typeof fetch;
  maxArticles?: number;
  timeoutMs?: number;
}): Promise<FeedArticle[]>
```

### runCommunityBatch deps への追加

```typescript
/** 外部フィード取得関数（#491 / ADR-0035）。省略時は fetchExternalFeed を使う。 */
feedFetcher?: (feedUrl: string) => Promise<FeedArticle[]>;
```

### プロンプト注入形式

`feedArticles` が指定された場合、`synopsisSection` の直後に挿入:

```
最新フィード記事（N件）:
- 「{title}」{author ? `（by {author}）` : ''}
  URL: {url}
  概要: {summary}
```

### XML パース

- `cheerio` (既存依存) + `{ xmlMode: true }` で RSS/Atom 両対応
- RSS: `$('item')` → title/link/description/author or dc\:creator
- Atom: `$('entry')` → title/link[href]/summary/author name
- description/summary の HTML タグは `.text()` で除去

## 5. 影響範囲 / 既存への変更

- **common**: `community.ts` に `feedUrl` を `UpdateCommunitySchema` へ追加
- **server/persistence**: `communityRepository.ts` / `prismaCommunityRepository.ts` に `feedUrl` 追加
- **server/prisma**: `schema.prisma` に `feedUrl String?` 追加 + マイグレーション
- **server/batch**: `fetchExternalFeed.ts` 新規、`buildCommunityPrompt.ts` / `runCommunityBatch.ts` 更新
- **server/routes**: `admin.ts` / `registerCommunities.ts` に `feedUrl` 追加
- **e2e**: ユーザー可視の振る舞い変更なし（admin 操作のみ）

## 6. テスト計画（TDD で書くテスト一覧）

### fetchExternalFeed.test.ts（新規）
- RSS 2.0 を正常にパースして FeedArticle[] を返す
- Atom をパースして FeedArticle[] を返す
- maxArticles で件数を制限する
- 取得失敗（fetch エラー）で空配列を返す
- HTTP エラー（4xx/5xx）で空配列を返す
- タイムアウトで空配列を返す
- XML パース失敗（不正な XML）で空配列を返す
- author/summary が無い場合は null を返す

### buildCommunityPrompt.test.ts（既存に追加）
- feedArticles が指定された場合にプロンプトに注入される
- feedArticles が省略された場合はプロンプトに変化なし
- feedArticles が空配列の場合はプロンプトに変化なし

### runCommunityBatch.test.ts（既存に追加）
- community.feedUrl がある場合に feedFetcher が呼ばれる
- feedFetcher が空配列を返した場合はフォールバックして通常生成
- community.feedUrl がない場合は feedFetcher を呼ばない

### common/community.test.ts（既存に追加）
- UpdateCommunitySchema が feedUrl を受け付ける
- feedUrl が 500 文字超の場合は失敗
- feedUrl が null の場合は成功（クリア操作）

## 7. リスク・未決事項

- Zenn RSS は現在 `https://zenn.dev/feed` で取得可能（stg で実証済み）。URL 変更リスクは低い。
- cheerio の xmlMode は名前空間（dc:creator 等）を属性として扱うため、セレクタを `[dc\\:creator]` で取得する必要がある（要確認・テストで検証）。
- `globalThis.fetch` は Node 26 で標準実装。テスト環境（Vitest/jsdom）でも利用可。
