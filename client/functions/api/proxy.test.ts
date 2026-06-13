import { describe, expect, it } from "vitest";

import { buildTargetUrl, resolveApiOrigin } from "./proxy";

describe("buildTargetUrl（/api/* の転送先 URL 組み立て）", () => {
  it("リクエストの pathname と query を API オリジンへ付け替える", () => {
    expect(
      buildTargetUrl("https://api.example.com", "https://develop.hatchery.pages.dev/api/auth/google"),
    ).toBe("https://api.example.com/api/auth/google");
  });

  it("query 文字列を保持する（OAuth の code/state 等）", () => {
    expect(
      buildTargetUrl(
        "https://api.example.com",
        "https://develop.hatchery.pages.dev/api/auth/google/callback?code=abc&state=xyz",
      ),
    ).toBe("https://api.example.com/api/auth/google/callback?code=abc&state=xyz");
  });

  it("API オリジンの末尾スラッシュは重複しない", () => {
    expect(buildTargetUrl("https://api.example.com/", "https://pages.dev/api/auth/me")).toBe(
      "https://api.example.com/api/auth/me",
    );
  });
});

describe("resolveApiOrigin（転送先オリジンの解決）", () => {
  it("API_BASE_URL が設定されていればそれを使う", () => {
    expect(resolveApiOrigin({ API_BASE_URL: "https://configured.run.app" }, "https://fallback.run.app")).toBe(
      "https://configured.run.app",
    );
  });

  it("未設定なら fallback を使う", () => {
    expect(resolveApiOrigin({}, "https://fallback.run.app")).toBe("https://fallback.run.app");
  });

  it("空文字は未設定扱いで fallback を使う（自己ループ回避）", () => {
    expect(resolveApiOrigin({ API_BASE_URL: "  " }, "https://fallback.run.app")).toBe("https://fallback.run.app");
  });
});
