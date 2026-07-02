// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { onRequest } from "./[id]";

type MockElement = {
  remove: () => void;
  append: (content: string) => void;
};

type MockHandler = {
  element?: (el: MockElement) => void;
};

// HTMLRewriter mock that processes HTML text (Cloudflare Workers API is unavailable in Node.js)
class MockHTMLRewriter {
  private _rules: Array<{ selector: string; handler: MockHandler }> = [];

  // eslint-disable-next-line max-params
  on(selector: string, handler: MockHandler) {
    this._rules.push({ selector, handler });
    return this;
  }

  transform(response: Response): Response {
    const rules = this._rules;
    const body = new ReadableStream({
      start(ctrl) {
        void response.text().then((html) => {
          let result = html;

          for (const { selector, handler } of rules) {
            if (!handler.element) continue;

            if (selector === "head") {
              let appended = "";
              handler.element({ remove: () => {}, append: (c) => { appended += c; } });
              result = result.replace("</head>", appended + "</head>");
            } else {
              const m = selector.match(/^meta\[(property|name)="([^"]+)"\]$/);
              if (!m) continue;
              const [, attr, val] = m;
              const esc = val.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              const re = new RegExp(`<meta\\s[^>]*${attr}="${esc}"[^>]*\\/?>`, "gi");
              result = result.replace(re, (match) => {
                let removed = false;
                handler.element!({ remove: () => { removed = true; }, append: () => {} });
                return removed ? "" : match;
              });
            }
          }

          ctrl.enqueue(new TextEncoder().encode(result));
          ctrl.close();
        });
      },
    });

    return new Response(body, { status: response.status, headers: response.headers });
  }
}

const HTML_WITH_STATIC_OGP = `<!doctype html>
<html>
<head>
<meta property="og:title" content="Hatchery" />
<meta property="og:description" content="静的説明文" />
<meta property="og:url" content="https://hatchery-works.com" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Hatchery" />
<meta name="twitter:description" content="静的説明文" />
</head>
<body></body>
</html>`;

const CRAWLER_UA = "facebookexternalhit/1.1";
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0";

const MOCK_COMMUNITIES = [
  {
    id: "comm-1",
    slug: "hatchery",
    name: "Hatchery General",
    description: "Hatchery の総合コミュニティです。",
  },
];

function makeContext({ ua, slug }: { ua: string; slug: string }) {
  return {
    request: new Request(`https://hatchery-works.com/communities/${slug}`, {
      headers: { "user-agent": ua },
    }),
    env: {},
    params: { id: slug },
    next: async () =>
      new Response(HTML_WITH_STATIC_OGP, { headers: { "content-type": "text/html" } }),
    waitUntil: () => {},
  };
}

describe("onRequest (communities/[id].ts)", () => {
  beforeEach(() => {
    vi.stubGlobal("HTMLRewriter", MockHTMLRewriter);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(MOCK_COMMUNITIES), {
          headers: { "content-type": "application/json" },
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("非クローラ UA の場合は next() をそのまま返す（OGP 変換しない）", async () => {
    const ctx = makeContext({ ua: BROWSER_UA, slug: "hatchery" });
    const res = await onRequest(ctx);
    const html = await res.text();
    expect(html).toBe(HTML_WITH_STATIC_OGP);
  });

  it("クローラ UA + API 取得失敗時は next() をそのまま返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    const ctx = makeContext({ ua: CRAWLER_UA, slug: "hatchery" });
    const res = await onRequest(ctx);
    const html = await res.text();
    expect(html).toBe(HTML_WITH_STATIC_OGP);
  });

  it("クローラ UA + slug 不一致のコミュニティは next() をそのまま返す", async () => {
    const ctx = makeContext({ ua: CRAWLER_UA, slug: "no-such-community" });
    const res = await onRequest(ctx);
    const html = await res.text();
    expect(html).toBe(HTML_WITH_STATIC_OGP);
  });

  it("クローラ UA + コミュニティ取得成功: og:title がコミュニティ名を含む", async () => {
    const ctx = makeContext({ ua: CRAWLER_UA, slug: "hatchery" });
    const res = await onRequest(ctx);
    const html = await res.text();
    expect(html).toContain('content="Hatchery General - Hatchery"');
  });

  it("クローラ UA + コミュニティ取得成功: og:title が1つのみ存在する（重複なし）", async () => {
    const ctx = makeContext({ ua: CRAWLER_UA, slug: "hatchery" });
    const res = await onRequest(ctx);
    const html = await res.text();
    const matches = html.match(/property="og:title"/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("クローラ UA + コミュニティ取得成功: og:description が1つのみ存在する（重複なし）", async () => {
    const ctx = makeContext({ ua: CRAWLER_UA, slug: "hatchery" });
    const res = await onRequest(ctx);
    const html = await res.text();
    const matches = html.match(/property="og:description"/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("クローラ UA + コミュニティ取得成功: og:url が1つのみ存在する（重複なし）", async () => {
    const ctx = makeContext({ ua: CRAWLER_UA, slug: "hatchery" });
    const res = await onRequest(ctx);
    const html = await res.text();
    const matches = html.match(/property="og:url"/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("クローラ UA + コミュニティ取得成功: twitter:title が1つのみ存在する（重複なし）", async () => {
    const ctx = makeContext({ ua: CRAWLER_UA, slug: "hatchery" });
    const res = await onRequest(ctx);
    const html = await res.text();
    const matches = html.match(/name="twitter:title"/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("クローラ UA + コミュニティ取得成功: twitter:description が1つのみ存在する（重複なし）", async () => {
    const ctx = makeContext({ ua: CRAWLER_UA, slug: "hatchery" });
    const res = await onRequest(ctx);
    const html = await res.text();
    const matches = html.match(/name="twitter:description"/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("変換後も og:type・og:image・twitter:card は除去されない", async () => {
    const ctx = makeContext({ ua: CRAWLER_UA, slug: "hatchery" });
    const res = await onRequest(ctx);
    const html = await res.text();
    expect(html).toContain('property="og:type"');
    expect(html).toContain('name="twitter:card"');
  });
});
