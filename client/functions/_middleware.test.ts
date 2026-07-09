// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { onRequest } from "./_middleware";

const PASSTHROUGH_BODY = "passthrough";

function makeContext({
  path,
  env,
  authHeader,
}: {
  path: string;
  env: { BASIC_AUTH_USER?: string; BASIC_AUTH_PASSWORD?: string };
  authHeader?: string;
}) {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) {
    headers.Authorization = authHeader;
  }
  return {
    request: new Request(`https://hatchery-works.com${path}`, { headers }),
    env,
    params: {},
    data: {},
    next: vi.fn(async () => new Response(PASSTHROUGH_BODY)),
    waitUntil: () => {},
    passThroughOnException: () => {},
  };
}

describe("onRequest (_middleware.ts)", () => {
  it("/api/ から始まるパスは環境変数が設定されていても next() をそのまま返す", async () => {
    const ctx = makeContext({
      path: "/api/auth/callback",
      env: { BASIC_AUTH_USER: "user", BASIC_AUTH_PASSWORD: "pass" },
    });
    const res = await onRequest(ctx);
    expect(ctx.next).toHaveBeenCalledTimes(1);
    expect(await res.text()).toBe(PASSTHROUGH_BODY);
  });

  it("環境変数が未設定の場合、/api/ 以外のパスでも next() をそのまま返す", async () => {
    const ctx = makeContext({ path: "/account", env: {} });
    const res = await onRequest(ctx);
    expect(ctx.next).toHaveBeenCalledTimes(1);
    expect(await res.text()).toBe(PASSTHROUGH_BODY);
  });

  it("環境変数設定済み + 正しい認証ヘッダーの場合、next() をそのまま返す", async () => {
    const ctx = makeContext({
      path: "/account",
      env: { BASIC_AUTH_USER: "user", BASIC_AUTH_PASSWORD: "pass" },
      authHeader: "Basic " + btoa("user:pass"),
    });
    const res = await onRequest(ctx);
    expect(ctx.next).toHaveBeenCalledTimes(1);
    expect(await res.text()).toBe(PASSTHROUGH_BODY);
  });

  it("環境変数設定済み + 認証ヘッダーなしの場合、401 と WWW-Authenticate ヘッダーを返す", async () => {
    const ctx = makeContext({
      path: "/account",
      env: { BASIC_AUTH_USER: "user", BASIC_AUTH_PASSWORD: "pass" },
    });
    const res = await onRequest(ctx);
    expect(ctx.next).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("Basic");
  });

  it("環境変数設定済み + 不正な認証ヘッダーの場合、401 と WWW-Authenticate ヘッダーを返す", async () => {
    const ctx = makeContext({
      path: "/account",
      env: { BASIC_AUTH_USER: "user", BASIC_AUTH_PASSWORD: "pass" },
      authHeader: "Basic " + btoa("wrong:pass"),
    });
    const res = await onRequest(ctx);
    expect(ctx.next).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("Basic");
  });
});
