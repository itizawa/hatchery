import { describe, expect, it } from "vitest";

import { SearchQuerySchema } from "./search.js";

describe("SearchQuerySchema", () => {
  it("有効なクエリ（1文字）を受け入れる", () => {
    expect(SearchQuerySchema.safeParse({ q: "a" }).success).toBe(true);
  });

  it("有効なクエリ（200文字）を受け入れる", () => {
    expect(SearchQuerySchema.safeParse({ q: "a".repeat(200) }).success).toBe(true);
  });

  it("空文字は無効", () => {
    expect(SearchQuerySchema.safeParse({ q: "" }).success).toBe(false);
  });

  it("201文字は無効（max 200）", () => {
    expect(SearchQuerySchema.safeParse({ q: "a".repeat(201) }).success).toBe(false);
  });

  it("q が未指定は無効", () => {
    expect(SearchQuerySchema.safeParse({}).success).toBe(false);
  });
});
