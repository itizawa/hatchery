import { afterEach, describe, expect, it, vi } from "vitest";

import { subscribePush, unsubscribePush } from "./push.js";

describe("subscribePush (POST /api/push-subscriptions)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("成功時に正しいエンドポイント・ボディでリクエストする", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      subscribePush({ endpoint: "https://push.example.com/abc", p256dh: "p256dh-key", auth: "auth-key" }),
    ).resolves.toBeUndefined();

    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/push-subscriptions");
    expect(request.method).toBe("POST");
    expect(request.credentials).toBe("include");
    const body = await request.clone().json();
    expect(body).toEqual({
      endpoint: "https://push.example.com/abc",
      p256dh: "p256dh-key",
      auth: "auth-key",
    });
  });

  it("サーバエラー応答時に例外を投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));

    await expect(
      subscribePush({ endpoint: "https://push.example.com/abc", p256dh: "p256dh-key", auth: "auth-key" }),
    ).rejects.toThrow();
  });
});

describe("unsubscribePush (DELETE /api/push-subscriptions)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("成功時に正しいエンドポイント・ボディでリクエストする", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      unsubscribePush({ endpoint: "https://push.example.com/abc" }),
    ).resolves.toBeUndefined();

    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/push-subscriptions");
    expect(request.method).toBe("DELETE");
    const body = await request.clone().json();
    expect(body).toEqual({ endpoint: "https://push.example.com/abc" });
  });

  it("サーバエラー応答時に例外を投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    await expect(unsubscribePush({ endpoint: "https://push.example.com/abc" })).rejects.toThrow();
  });
});
