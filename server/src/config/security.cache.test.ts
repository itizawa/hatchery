import { describe, expect, it } from "vitest";

import {
  CACHE_DEFAULTS,
  buildPublicCacheControl,
  buildPrivateCacheControl,
} from "./security.js";

describe("CACHE_DEFAULTS（キャッシュ方針の単一情報源・#559 AC1/AC5）", () => {
  it("既定値は s-maxage=60・stale-while-revalidate=300", () => {
    expect(CACHE_DEFAULTS).toEqual({
      sMaxageSeconds: 60,
      staleWhileRevalidateSeconds: 300,
    });
  });
});

describe("buildPublicCacheControl（#559 AC2）", () => {
  it("public + s-maxage + stale-while-revalidate を組み立てる", () => {
    expect(
      buildPublicCacheControl({ sMaxageSeconds: 60, staleWhileRevalidateSeconds: 300 }),
    ).toBe("public, s-maxage=60, stale-while-revalidate=300");
  });

  it("秒数の上書きが反映される（env 上書き余地・AC1）", () => {
    expect(
      buildPublicCacheControl({ sMaxageSeconds: 120, staleWhileRevalidateSeconds: 600 }),
    ).toBe("public, s-maxage=120, stale-while-revalidate=600");
  });
});

describe("buildPrivateCacheControl（#559 AC3）", () => {
  it("private, no-store を返し public/s-maxage を含まない", () => {
    const value = buildPrivateCacheControl();
    expect(value).toBe("private, no-store");
    expect(value).not.toContain("public");
    expect(value).not.toContain("s-maxage");
  });
});
