import { describe, expect, it } from "vitest";

import { HomeFeedQuerySchema } from "./feed.js";

describe("HomeFeedQuerySchema", () => {
  it("デフォルト値: limit=20", () => {
    const result = HomeFeedQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(20);
  });

  it("limit=1 は有効", () => {
    const result = HomeFeedQuerySchema.safeParse({ limit: 1 });
    expect(result.success).toBe(true);
  });

  it("limit=100 は有効", () => {
    const result = HomeFeedQuerySchema.safeParse({ limit: 100 });
    expect(result.success).toBe(true);
  });

  it("limit=101 は無効", () => {
    const result = HomeFeedQuerySchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });

  it("limit=0 は無効", () => {
    const result = HomeFeedQuerySchema.safeParse({ limit: 0 });
    expect(result.success).toBe(false);
  });

  it("文字列の limit は coerce で変換される", () => {
    const result = HomeFeedQuerySchema.safeParse({ limit: "10" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(10);
  });

  it("cursor は 512 文字以下であれば有効", () => {
    const result = HomeFeedQuerySchema.safeParse({ cursor: "a".repeat(512) });
    expect(result.success).toBe(true);
  });

  it("cursor が 513 文字以上は無効", () => {
    const result = HomeFeedQuerySchema.safeParse({ cursor: "a".repeat(513) });
    expect(result.success).toBe(false);
  });

  it("cursor は省略可能", () => {
    const result = HomeFeedQuerySchema.safeParse({ limit: 20 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.cursor).toBeUndefined();
  });

  it("sort 省略時はデフォルト latest", () => {
    const result = HomeFeedQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.sort).toBe("latest");
  });

  it("sort=popular は有効", () => {
    const result = HomeFeedQuerySchema.safeParse({ sort: "popular" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.sort).toBe("popular");
  });

  it("sort=latest は有効", () => {
    const result = HomeFeedQuerySchema.safeParse({ sort: "latest" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.sort).toBe("latest");
  });

  it("sort が enum 外の値は無効", () => {
    const result = HomeFeedQuerySchema.safeParse({ sort: "hot" });
    expect(result.success).toBe(false);
  });
});
