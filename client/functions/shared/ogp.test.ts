// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildOgpMetaHtml, escapeHtmlAttr, isCrawler, resolveApiBase } from "./ogp";

describe("isCrawler", () => {
  it("Twitterbot を含む UA は true", () => {
    expect(isCrawler("Twitterbot/1.0")).toBe(true);
  });

  it("Slackbot を含む UA は true", () => {
    expect(isCrawler("Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)")).toBe(true);
  });

  it("facebookexternalhit を含む UA は true", () => {
    expect(isCrawler("facebookexternalhit/1.1")).toBe(true);
  });

  it("Discordbot を含む UA は true", () => {
    expect(isCrawler("Mozilla/5.0 (compatible; Discordbot/2.0)")).toBe(true);
  });

  it("一般的な bot を含む UA は true（大文字小文字無視）", () => {
    expect(isCrawler("SomeRandomBot/1.0")).toBe(true);
  });

  it("通常の Chrome ブラウザ UA は false", () => {
    expect(
      isCrawler(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      ),
    ).toBe(false);
  });

  it("Safari ブラウザ UA は false", () => {
    expect(
      isCrawler(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(false);
  });

  it("null の UA は false", () => {
    expect(isCrawler(null)).toBe(false);
  });

  it("空文字の UA は false", () => {
    expect(isCrawler("")).toBe(false);
  });
});

describe("resolveApiBase", () => {
  it("env.API_BASE_URL があればそれを返す（末尾スラッシュは除去）", () => {
    expect(
      resolveApiBase({ API_BASE_URL: "https://api.example.com/" }, "https://hatchery.example/posts/x"),
    ).toBe("https://api.example.com");
  });

  it("env.API_BASE_URL が無ければリクエストの origin を返す", () => {
    expect(resolveApiBase({}, "https://hatchery.example/posts/x")).toBe("https://hatchery.example");
  });

  it("env.API_BASE_URL が空文字ならリクエストの origin を返す", () => {
    expect(resolveApiBase({ API_BASE_URL: "" }, "https://hatchery.example/posts/x")).toBe(
      "https://hatchery.example",
    );
  });
});

describe("escapeHtmlAttr", () => {
  it("ダブルクォート・アンパサンド・不等号をエスケープする", () => {
    expect(escapeHtmlAttr(`a"b&c<d>e`)).toBe("a&quot;b&amp;c&lt;d&gt;e");
  });

  it("通常の文字列はそのまま", () => {
    expect(escapeHtmlAttr("雑談 - Hatchery")).toBe("雑談 - Hatchery");
  });
});

describe("buildOgpMetaHtml", () => {
  it("og:title / og:description / og:url / twitter:title / twitter:description の meta タグを生成する", () => {
    const html = buildOgpMetaHtml({
      title: "テスト投稿 - Hatchery",
      description: "テスト説明文",
      url: "https://hatchery.example/posts/abc",
    });
    expect(html).toContain('<meta property="og:title" content="テスト投稿 - Hatchery" />');
    expect(html).toContain('<meta property="og:description" content="テスト説明文" />');
    expect(html).toContain('<meta property="og:url" content="https://hatchery.example/posts/abc" />');
    expect(html).toContain('<meta name="twitter:title" content="テスト投稿 - Hatchery" />');
    expect(html).toContain('<meta name="twitter:description" content="テスト説明文" />');
  });

  it("HTML 特殊文字をエスケープする", () => {
    const html = buildOgpMetaHtml({
      title: 'タイトル"with"quotes',
      description: "desc<script>alert(1)</script>",
      url: "https://example.com",
    });
    expect(html).toContain("&quot;");
    expect(html).toContain("&lt;");
    expect(html).toContain("&gt;");
    expect(html).not.toContain("<script>");
  });
});
