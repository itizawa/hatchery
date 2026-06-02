import { describe, expect, it } from "vitest";

import { AuthUserSchema, LoginRequestSchema, UpdateProfileSchema } from "./auth.js";

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

  // #49: 自身の Employee を指す employeeId（任意）。
  it("employeeId を付与してもパースが成功する（AC-8）", () => {
    const result = AuthUserSchema.safeParse({ id: "user1", displayName: "Alice", employeeId: "emp1" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.employeeId).toBe("emp1");
    }
  });

  it("employeeId を省略してもパースが成功する（AC-8 / 任意フィールド）", () => {
    const result = AuthUserSchema.safeParse({ id: "user1", displayName: "Alice" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.employeeId).toBeUndefined();
    }
  });

  it("avatarUrl を付与してもパースが成功する（#51）", () => {
    const result = AuthUserSchema.safeParse({
      id: "user1",
      displayName: "Alice",
      avatarUrl: "https://example.com/avatar.png",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.avatarUrl).toBe("https://example.com/avatar.png");
    }
  });

  it("avatarUrl を省略してもパースが成功する（#51 / 任意フィールド）", () => {
    const result = AuthUserSchema.safeParse({ id: "user1", displayName: "Alice" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.avatarUrl).toBeUndefined();
    }
  });
});

describe("UpdateProfileSchema (#51)", () => {
  it("displayName のみで成功する", () => {
    const result = UpdateProfileSchema.safeParse({ displayName: "新しい名前" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.displayName).toBe("新しい名前");
      expect(result.data.avatarUrl).toBeUndefined();
    }
  });

  it("displayName + 有効な avatarUrl で成功する", () => {
    const result = UpdateProfileSchema.safeParse({
      displayName: "Alice",
      avatarUrl: "https://example.com/avatar.png",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.avatarUrl).toBe("https://example.com/avatar.png");
    }
  });

  it("displayName が空文字のとき失敗する", () => {
    const result = UpdateProfileSchema.safeParse({ displayName: "" });
    expect(result.success).toBe(false);
  });

  it("displayName が欠落しているとき失敗する", () => {
    const result = UpdateProfileSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("avatarUrl が不正な URL 形式のとき失敗する", () => {
    const result = UpdateProfileSchema.safeParse({
      displayName: "Alice",
      avatarUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });
});
