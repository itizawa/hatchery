// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MockHTMLRewriter } from "../shared/mock-html-rewriter";
import { onRequest } from "./[id]";

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

function makeContext({ ua, postId }: { ua: string; postId: string }) {
  return {
    request: new Request(`https://hatchery-works.com/posts/${postId}`, {
      headers: { "user-agent": ua },
    }),
    env: {},
    params: { id: postId },
    next: async () =>
      new Response(HTML_WITH_STATIC_OGP, { headers: { "content-type": "text/html" } }),
    waitUntil: () => {},
  };
}

describe("onRequest (posts/[id].ts)", () => {
  beforeEach(() => {
    vi.stubGlobal("HTMLRewriter", MockHTMLRewriter);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            post: { id: "post-1", title: "AI の未来", text: "本文です。" },
          }),
          { headers: { "content-type": "application/json" } },
        ),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("非クローラ UA の場合は next() をそのまま返す（OGP 変換しない）", async () => {
    const ctx = makeContext({ ua: BROWSER_UA, postId: "post-1" });
    const res = await onRequest(ctx);
    const html = await res.text();
    expect(html).toBe(HTML_WITH_STATIC_OGP);
  });

  it("クローラ UA + 投稿取得失敗時は next() をそのまま返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    const ctx = makeContext({ ua: CRAWLER_UA, postId: "post-1" });
    const res = await onRequest(ctx);
    const html = await res.text();
    expect(html).toBe(HTML_WITH_STATIC_OGP);
  });

  it("クローラ UA + 投稿取得成功: og:title が投稿タイトルを含む", async () => {
    const ctx = makeContext({ ua: CRAWLER_UA, postId: "post-1" });
    const res = await onRequest(ctx);
    const html = await res.text();
    expect(html).toContain('content="AI の未来 - Hatchery"');
  });

  it("クローラ UA + 投稿取得成功: og:title が1つのみ存在する（重複なし）", async () => {
    const ctx = makeContext({ ua: CRAWLER_UA, postId: "post-1" });
    const res = await onRequest(ctx);
    const html = await res.text();
    const matches = html.match(/property="og:title"/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("クローラ UA + 投稿取得成功: og:description が1つのみ存在する（重複なし）", async () => {
    const ctx = makeContext({ ua: CRAWLER_UA, postId: "post-1" });
    const res = await onRequest(ctx);
    const html = await res.text();
    const matches = html.match(/property="og:description"/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("クローラ UA + 投稿取得成功: og:url が1つのみ存在する（重複なし）", async () => {
    const ctx = makeContext({ ua: CRAWLER_UA, postId: "post-1" });
    const res = await onRequest(ctx);
    const html = await res.text();
    const matches = html.match(/property="og:url"/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("クローラ UA + 投稿取得成功: twitter:title が1つのみ存在する（重複なし）", async () => {
    const ctx = makeContext({ ua: CRAWLER_UA, postId: "post-1" });
    const res = await onRequest(ctx);
    const html = await res.text();
    const matches = html.match(/name="twitter:title"/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("クローラ UA + 投稿取得成功: twitter:description が1つのみ存在する（重複なし）", async () => {
    const ctx = makeContext({ ua: CRAWLER_UA, postId: "post-1" });
    const res = await onRequest(ctx);
    const html = await res.text();
    const matches = html.match(/name="twitter:description"/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("変換後も og:type・og:image・twitter:card は除去されない", async () => {
    const ctx = makeContext({ ua: CRAWLER_UA, postId: "post-1" });
    const res = await onRequest(ctx);
    const html = await res.text();
    expect(html).toContain('property="og:type"');
    expect(html).toContain('name="twitter:card"');
  });
});
