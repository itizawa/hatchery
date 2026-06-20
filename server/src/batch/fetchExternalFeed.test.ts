import { describe, expect, it } from "vitest";

import { fetchExternalFeed } from "./fetchExternalFeed.js";

const RSS_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Zenn Tech</title>
    <item>
      <title>TypeScript 5.0 の新機能</title>
      <link>https://zenn.dev/articles/ts50</link>
      <description>TypeScript 5.0 の主要な変更点を解説します。</description>
      <dc:creator>yamada</dc:creator>
    </item>
    <item>
      <title>Prisma ORM 入門</title>
      <link>https://zenn.dev/articles/prisma-intro</link>
      <description>Prisma の基本的な使い方を学ぶ記事です。</description>
      <author>sato@example.com (sato)</author>
    </item>
    <item>
      <title>React 19 の変化点</title>
      <link>https://zenn.dev/articles/react19</link>
      <description>React 19 が正式リリースされました。</description>
    </item>
  </channel>
</rss>`;

const ATOM_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>技術ブログ</title>
  <entry>
    <title>GraphQL を使った API 設計</title>
    <link href="https://example.com/graphql"/>
    <summary>GraphQL で型安全な API を設計する方法。</summary>
    <author><name>tanaka</name></author>
  </entry>
  <entry>
    <title>Docker Compose 活用術</title>
    <link href="https://example.com/docker"/>
    <summary>Docker Compose でローカル環境を構築する手順。</summary>
  </entry>
</feed>`;

const RSS_WITH_HTML_DESC = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>HTML 入りの説明</title>
      <link>https://example.com/html</link>
      <description><![CDATA[<p>これは <strong>HTML</strong> を含む記事の説明です。</p>]]></description>
    </item>
  </channel>
</rss>`;

function makeFetcher(xml: string, status = 200) {
  return async (_url: string, _init?: RequestInit) => {
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => xml,
    } as Response;
  };
}

function makeFailFetcher(error: Error) {
  return async (_url: string, _init?: RequestInit): Promise<Response> => {
    throw error;
  };
}

describe("fetchExternalFeed", () => {
  describe("RSS 2.0 のパース", () => {
    it("RSS の item を FeedArticle[] に変換する", async () => {
      const result = await fetchExternalFeed({
        feedUrl: "https://zenn.dev/feed",
        fetcher: makeFetcher(RSS_SAMPLE),
      });

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        title: "TypeScript 5.0 の新機能",
        url: "https://zenn.dev/articles/ts50",
        summary: "TypeScript 5.0 の主要な変更点を解説します。",
        author: "yamada",
      });
    });

    it("author タグが無い item は author: null を返す", async () => {
      const result = await fetchExternalFeed({
        feedUrl: "https://zenn.dev/feed",
        fetcher: makeFetcher(RSS_SAMPLE),
      });
      expect(result[2]?.author).toBeNull();
    });

    it("description の HTML タグを除去してテキストのみを返す", async () => {
      const result = await fetchExternalFeed({
        feedUrl: "https://example.com/feed",
        fetcher: makeFetcher(RSS_WITH_HTML_DESC),
      });
      expect(result[0]?.summary).not.toContain("<p>");
      expect(result[0]?.summary).not.toContain("<strong>");
      expect(result[0]?.summary).toContain("HTML");
    });
  });

  describe("Atom のパース", () => {
    it("Atom の entry を FeedArticle[] に変換する", async () => {
      const result = await fetchExternalFeed({
        feedUrl: "https://example.com/feed.atom",
        fetcher: makeFetcher(ATOM_SAMPLE),
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        title: "GraphQL を使った API 設計",
        url: "https://example.com/graphql",
        summary: "GraphQL で型安全な API を設計する方法。",
        author: "tanaka",
      });
    });

    it("author が無い entry は author: null を返す", async () => {
      const result = await fetchExternalFeed({
        feedUrl: "https://example.com/feed.atom",
        fetcher: makeFetcher(ATOM_SAMPLE),
      });
      expect(result[1]?.author).toBeNull();
    });
  });

  describe("件数制限", () => {
    it("maxArticles で件数を制限する", async () => {
      const result = await fetchExternalFeed({
        feedUrl: "https://zenn.dev/feed",
        fetcher: makeFetcher(RSS_SAMPLE),
        maxArticles: 2,
      });
      expect(result).toHaveLength(2);
    });

    it("デフォルトの maxArticles は 6", async () => {
      const manyItems = Array.from(
        { length: 10 },
        (_, i) => `
        <item>
          <title>記事${i + 1}</title>
          <link>https://example.com/${i + 1}</link>
          <description>説明${i + 1}</description>
        </item>`,
      ).join("");
      const feed = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>${manyItems}</channel></rss>`;

      const result = await fetchExternalFeed({
        feedUrl: "https://example.com/feed",
        fetcher: makeFetcher(feed),
      });
      expect(result).toHaveLength(6);
    });
  });

  describe("エラーハンドリング", () => {
    it("fetch が例外を throw した場合は空配列を返す", async () => {
      const result = await fetchExternalFeed({
        feedUrl: "https://example.com/feed",
        fetcher: makeFailFetcher(new Error("network error")),
      });
      expect(result).toEqual([]);
    });

    it("HTTP 4xx エラーは空配列を返す", async () => {
      const result = await fetchExternalFeed({
        feedUrl: "https://example.com/feed",
        fetcher: makeFetcher("Not Found", 404),
      });
      expect(result).toEqual([]);
    });

    it("HTTP 5xx エラーは空配列を返す", async () => {
      const result = await fetchExternalFeed({
        feedUrl: "https://example.com/feed",
        fetcher: makeFetcher("Server Error", 500),
      });
      expect(result).toEqual([]);
    });

    it("不正な XML（パース失敗）は空配列を返す", async () => {
      const result = await fetchExternalFeed({
        feedUrl: "https://example.com/feed",
        fetcher: makeFetcher("<not valid xml >><><"),
      });
      expect(result).toEqual([]);
    });

    it("RSS でも Atom でもない XML は空配列を返す", async () => {
      const result = await fetchExternalFeed({
        feedUrl: "https://example.com/feed",
        fetcher: makeFetcher("<root><something>hello</something></root>"),
      });
      expect(result).toEqual([]);
    });
  });
});
