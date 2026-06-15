import { describe, expect, it } from "vitest";

import { OgpMetaSchema, OgpUrlQuerySchema, OGP_URL_MAX_LENGTH } from "./ogp.js";

describe("OgpUrlQuerySchema (#515)", () => {
  it("有効な http URL を受け付ける", () => {
    const result = OgpUrlQuerySchema.safeParse({ url: "http://example.com" });
    expect(result.success).toBe(true);
  });

  it("有効な https URL を受け付ける", () => {
    const result = OgpUrlQuerySchema.safeParse({ url: "https://example.com/path?q=1" });
    expect(result.success).toBe(true);
  });

  it("http/https 以外のスキームは reject する", () => {
    const result = OgpUrlQuerySchema.safeParse({ url: "ftp://example.com" });
    expect(result.success).toBe(false);
  });

  it("javascript: スキームは reject する", () => {
    const result = OgpUrlQuerySchema.safeParse({ url: "javascript:alert(1)" });
    expect(result.success).toBe(false);
  });

  it(`${OGP_URL_MAX_LENGTH} 文字は受け付ける`, () => {
    const base = "https://example.com/";
    const url = base + "a".repeat(OGP_URL_MAX_LENGTH - base.length);
    const result = OgpUrlQuerySchema.safeParse({ url });
    expect(result.success).toBe(true);
  });

  it(`${OGP_URL_MAX_LENGTH + 1} 文字は reject する`, () => {
    const base = "https://example.com/";
    const url = base + "a".repeat(OGP_URL_MAX_LENGTH - base.length + 1);
    const result = OgpUrlQuerySchema.safeParse({ url });
    expect(result.success).toBe(false);
  });

  it("url が空文字は reject する", () => {
    const result = OgpUrlQuerySchema.safeParse({ url: "" });
    expect(result.success).toBe(false);
  });

  it("url が未定義は reject する", () => {
    const result = OgpUrlQuerySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("OgpMetaSchema (#515)", () => {
  it("すべて null でも有効", () => {
    const result = OgpMetaSchema.safeParse({
      title: null,
      description: null,
      image: null,
      site_name: null,
    });
    expect(result.success).toBe(true);
  });

  it("すべてのフィールドを持てる", () => {
    const result = OgpMetaSchema.safeParse({
      title: "Example Title",
      description: "Example description.",
      image: "https://example.com/og.png",
      site_name: "Example Site",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Example Title");
    }
  });

  it("フィールドが省略されても有効（optional として扱う）", () => {
    const result = OgpMetaSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
