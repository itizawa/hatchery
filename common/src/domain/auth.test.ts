import { describe, expect, it } from "vitest";

import { AuthUserSchema, LoginRequestSchema } from "./auth.js";

describe("LoginRequestSchema", () => {
  it("有効な id と password でパースが成功する", () => {
    const result = LoginRequestSchema.safeParse({ id: "user1", password: "pass1" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ id: "user1", password: "pass1" });
    }
  });

  it("id が空文字のとき失敗する", () => {
    const result = LoginRequestSchema.safeParse({ id: "", password: "pass1" });
    expect(result.success).toBe(false);
  });

  it("password が空文字のとき失敗する", () => {
    const result = LoginRequestSchema.safeParse({ id: "user1", password: "" });
    expect(result.success).toBe(false);
  });

  it("id が欠落しているとき失敗する", () => {
    const result = LoginRequestSchema.safeParse({ password: "pass1" });
    expect(result.success).toBe(false);
  });

  it("password が欠落しているとき失敗する", () => {
    const result = LoginRequestSchema.safeParse({ id: "user1" });
    expect(result.success).toBe(false);
  });
});

describe("AuthUserSchema", () => {
  it("有効な id と displayName でパースが成功する", () => {
    const result = AuthUserSchema.safeParse({ id: "user1", displayName: "Alice" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ id: "user1", displayName: "Alice" });
    }
  });

  it("passwordHash を含んでいても parseStrict しない（余分なフィールドは strip される）", () => {
    const result = AuthUserSchema.safeParse({ id: "user1", displayName: "Alice", passwordHash: "secret" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("passwordHash");
    }
  });
});
