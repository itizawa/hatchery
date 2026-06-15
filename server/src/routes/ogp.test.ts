import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app.js";
import { createTestDeps } from "../testing/createTestDeps.js";

/** globalThis.fetch をモックして HTML を返すヘルパー */
function mockFetchOk(html: string, contentType = "text/html; charset=utf-8") {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => (name.toLowerCase() === "content-type" ? contentType : null),
      },
      text: async () => html,
      body: null,
    }),
  );
}

/** globalThis.fetch をモックしてフェッチ失敗をシミュレートする */
function mockFetchFail() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error("fetch failed")),
  );
}

describe("GET /api/ogp (#515)", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp(createTestDeps());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("有効な https URL で OGP メタデータを返す", async () => {
    const html = `<html><head>
      <meta property="og:title" content="Test Title" />
      <meta property="og:description" content="Test Description" />
      <meta property="og:image" content="https://example.com/og.png" />
      <meta property="og:site_name" content="Example Site" />
    </head></html>`;
    mockFetchOk(html);

    const res = await request(app).get("/api/ogp?url=https://example.com");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      title: "Test Title",
      description: "Test Description",
      image: "https://example.com/og.png",
      site_name: "Example Site",
    });
  });

  it("OGP がない HTML でも null を返す（エラーにしない）", async () => {
    mockFetchOk("<html><head><title>Page</title></head></html>");

    const res = await request(app).get("/api/ogp?url=https://example.com");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      title: "Page",
      description: null,
      image: null,
      site_name: null,
    });
  });

  it("url パラメータがない場合は 400 を返す", async () => {
    const res = await request(app).get("/api/ogp");
    expect(res.status).toBe(400);
  });

  it("http/https 以外のスキームは 400 を返す", async () => {
    const res = await request(app).get("/api/ogp?url=ftp://example.com");
    expect(res.status).toBe(400);
  });

  it("localhost は SSRF ガードで 400 を返す", async () => {
    const res = await request(app).get("/api/ogp?url=http://localhost:3000/secret");
    expect(res.status).toBe(400);
  });

  it("127.0.0.1 は SSRF ガードで 400 を返す", async () => {
    const res = await request(app).get("/api/ogp?url=http://127.0.0.1/");
    expect(res.status).toBe(400);
  });

  it("10.0.0.1 (プライベート IP) は SSRF ガードで 400 を返す", async () => {
    const res = await request(app).get("/api/ogp?url=http://10.0.0.1/");
    expect(res.status).toBe(400);
  });

  it("192.168.1.1 (プライベート IP) は SSRF ガードで 400 を返す", async () => {
    const res = await request(app).get("/api/ogp?url=http://192.168.1.1/");
    expect(res.status).toBe(400);
  });

  it("172.16.0.1 (プライベート IP) は SSRF ガードで 400 を返す", async () => {
    const res = await request(app).get("/api/ogp?url=http://172.16.0.1/");
    expect(res.status).toBe(400);
  });

  it("169.254.1.1 (リンクローカル) は SSRF ガードで 400 を返す", async () => {
    const res = await request(app).get("/api/ogp?url=http://169.254.1.1/");
    expect(res.status).toBe(400);
  });

  it("フェッチ失敗時は OGP 空を返す（エラーにしない）", async () => {
    mockFetchFail();

    const res = await request(app).get("/api/ogp?url=https://example.com");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      title: null,
      description: null,
      image: null,
      site_name: null,
    });
  });

  it("Content-Type が非 HTML のときは OGP 空を返す", async () => {
    mockFetchOk('{"key": "value"}', "application/json");

    const res = await request(app).get("/api/ogp?url=https://example.com/data.json");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      title: null,
      description: null,
      image: null,
      site_name: null,
    });
  });
});
