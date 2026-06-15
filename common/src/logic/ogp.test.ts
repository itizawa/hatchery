import { describe, expect, it } from "vitest";

import { extractFirstUrl, extractOgpFromHtml } from "./ogp.js";

describe("extractFirstUrl (#515)", () => {
  it("テキストから先頭の https URL を抽出する", () => {
    const url = extractFirstUrl("こちらを参照: https://example.com/page");
    expect(url).toBe("https://example.com/page");
  });

  it("テキストから先頭の http URL を抽出する", () => {
    const url = extractFirstUrl("http://example.com is useful");
    expect(url).toBe("http://example.com");
  });

  it("URL のみのテキストから抽出する", () => {
    const url = extractFirstUrl("https://example.com");
    expect(url).toBe("https://example.com");
  });

  it("複数の URL がある場合は先頭 1 件のみを返す", () => {
    const url = extractFirstUrl("First: https://first.example.com then https://second.example.com");
    expect(url).toBe("https://first.example.com");
  });

  it("URL がない場合は null を返す", () => {
    const url = extractFirstUrl("これはただのテキストです。URL なし。");
    expect(url).toBeNull();
  });

  it("空文字は null を返す", () => {
    const url = extractFirstUrl("");
    expect(url).toBeNull();
  });

  it("クエリパラメータ付き URL を正しく抽出する", () => {
    const url = extractFirstUrl("See https://example.com/search?q=hello&page=2 for details");
    expect(url).toBe("https://example.com/search?q=hello&page=2");
  });

  it("URL の後のスペースは含めない", () => {
    const url = extractFirstUrl("See https://example.com here");
    expect(url).toBe("https://example.com");
  });

  it("URL の後の日本語テキストは含めない", () => {
    const url = extractFirstUrl("こちら https://example.com を参照");
    expect(url).toBe("https://example.com");
  });
});

describe("extractOgpFromHtml (#515)", () => {
  it("og:title を抽出する", () => {
    const html = `<html><head>
      <meta property="og:title" content="OGP Title" />
    </head></html>`;
    const ogp = extractOgpFromHtml(html);
    expect(ogp.title).toBe("OGP Title");
  });

  it("og:description を抽出する", () => {
    const html = `<html><head>
      <meta property="og:description" content="OGP Description" />
    </head></html>`;
    const ogp = extractOgpFromHtml(html);
    expect(ogp.description).toBe("OGP Description");
  });

  it("og:image を抽出する", () => {
    const html = `<html><head>
      <meta property="og:image" content="https://example.com/og.png" />
    </head></html>`;
    const ogp = extractOgpFromHtml(html);
    expect(ogp.image).toBe("https://example.com/og.png");
  });

  it("og:site_name を抽出する", () => {
    const html = `<html><head>
      <meta property="og:site_name" content="Example Site" />
    </head></html>`;
    const ogp = extractOgpFromHtml(html);
    expect(ogp.site_name).toBe("Example Site");
  });

  it("og:title がない場合は <title> タグにフォールバックする", () => {
    const html = `<html><head>
      <title>Page Title</title>
    </head></html>`;
    const ogp = extractOgpFromHtml(html);
    expect(ogp.title).toBe("Page Title");
  });

  it("og:title と <title> が両方あれば og:title を優先する", () => {
    const html = `<html><head>
      <title>Page Title</title>
      <meta property="og:title" content="OGP Title" />
    </head></html>`;
    const ogp = extractOgpFromHtml(html);
    expect(ogp.title).toBe("OGP Title");
  });

  it("OGP が何もない場合はすべて null を返す", () => {
    const html = `<html><head></head><body>text</body></html>`;
    const ogp = extractOgpFromHtml(html);
    expect(ogp.title).toBeNull();
    expect(ogp.description).toBeNull();
    expect(ogp.image).toBeNull();
    expect(ogp.site_name).toBeNull();
  });

  it("空文字を渡してもクラッシュしない", () => {
    const ogp = extractOgpFromHtml("");
    expect(ogp.title).toBeNull();
  });

  it("ダブルクオートと属性の順序が違っても抽出できる（content が先）", () => {
    const html = `<html><head>
      <meta content="OGP Title" property="og:title" />
    </head></html>`;
    const ogp = extractOgpFromHtml(html);
    expect(ogp.title).toBe("OGP Title");
  });
});
