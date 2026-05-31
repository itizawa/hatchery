import { describe, expect, it } from "vitest";

import { buildSecurityHeaders, CORS_DEFAULTS } from "./security.js";

describe("buildSecurityHeaders", () => {
  it("HSTS 無効時は必須セキュアヘッダ4種を含み Strict-Transport-Security を含まない", () => {
    const headers = buildSecurityHeaders(false);
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-XSS-Protection"]).toBe("1; mode=block");
    expect(headers["Referrer-Policy"]).toBe("no-referrer");
    expect(headers["Strict-Transport-Security"]).toBeUndefined();
  });

  it("HSTS 有効時は Strict-Transport-Security を含む", () => {
    const headers = buildSecurityHeaders(true);
    expect(headers["Strict-Transport-Security"]).toContain("max-age=");
  });
});

describe("CORS_DEFAULTS", () => {
  it("許可メソッド・許可ヘッダ・Max-Age の既定を持つ", () => {
    expect(CORS_DEFAULTS.methods).toContain("GET");
    expect(CORS_DEFAULTS.methods).toContain("POST");
    expect(CORS_DEFAULTS.allowedHeaders).toContain("Content-Type");
    expect(CORS_DEFAULTS.maxAgeSeconds).toBeGreaterThan(0);
  });
});
