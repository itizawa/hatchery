import { describe, expect, it } from "vitest";

import {
  AuthUserSchema,
  DISPLAY_NAME_MAX_LENGTH,
  LOGIN_ID_MAX_LENGTH,
  LoginRequestSchema,
  PASSWORD_MAX_LENGTH,
  UpdateProfileSchema,
  UserRoleSchema,
  isAdmin,
} from "./auth.js";

describe("LoginRequestSchema", () => {
  it("有効な id と password でパースが成功する", () => {
    const result = LoginRequestSchema.safeParse({ loginId: "user1", password: "pass1" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ loginId: "user1", password: "pass1" });
    }
  });

  it("id が空文字のとき失敗する", () => {
    const result = LoginRequestSchema.safeParse({ loginId: "", password: "pass1" });
    expect(result.success).toBe(false);
  });

  it("password が空文字のとき失敗する", () => {
    const result = LoginRequestSchema.safeParse({ loginId: "user1", password: "" });
    expect(result.success).toBe(false);
  });

  it("id が欠落しているとき失敗する", () => {
    const result = LoginRequestSchema.safeParse({ password: "pass1" }) // loginId欠落;
    expect(result.success).toBe(false);
  });

  it("password が欠落しているとき失敗する", () => {
    const result = LoginRequestSchema.safeParse({ loginId: "user1" });
    expect(result.success).toBe(false);
  });

  it("loginId が LOGIN_ID_MAX_LENGTH 文字ちょうどなら成功する（#91）", () => {
    const result = LoginRequestSchema.safeParse({ loginId: "a".repeat(LOGIN_ID_MAX_LENGTH), password: "pass1" });
    expect(result.success).toBe(true);
  });

  it("loginId が LOGIN_ID_MAX_LENGTH + 1 文字なら失敗する（#91）", () => {
    const result = LoginRequestSchema.safeParse({ loginId: "a".repeat(LOGIN_ID_MAX_LENGTH + 1), password: "pass1" });
    expect(result.success).toBe(false);
  });

  it("password が PASSWORD_MAX_LENGTH 文字ちょうどなら成功する（#91）", () => {
    const result = LoginRequestSchema.safeParse({ loginId: "user1", password: "a".repeat(PASSWORD_MAX_LENGTH) });
    expect(result.success).toBe(true);
  });

  it("password が PASSWORD_MAX_LENGTH + 1 文字なら失敗する（#91）", () => {
    const result = LoginRequestSchema.safeParse({ loginId: "user1", password: "a".repeat(PASSWORD_MAX_LENGTH + 1) });
    expect(result.success).toBe(false);
  });
});

describe("UserRoleSchema (#136)", () => {
  it("'admin' でパースが成功する", () => {
    const result = UserRoleSchema.safeParse("admin");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("admin");
  });

  it("'member' でパースが成功する", () => {
    const result = UserRoleSchema.safeParse("member");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("member");
  });

  it("不正な値（'owner'）のときパースが失敗する", () => {
    const result = UserRoleSchema.safeParse("owner");
    expect(result.success).toBe(false);
  });
});

describe("isAdmin (#136)", () => {
  it("role が 'admin' のとき true を返す", () => {
    expect(isAdmin({ id: "u1", displayName: "Alice", role: "admin" })).toBe(true);
  });

  it("role が 'member' のとき false を返す", () => {
    expect(isAdmin({ id: "u1", displayName: "Alice", role: "member" })).toBe(false);
  });
});

describe("AuthUserSchema", () => {
  it("id / displayName / role（admin）でパースが成功する", () => {
    const result = AuthUserSchema.safeParse({ id: "user1", loginId: "user1", displayName: "Alice", role: "admin" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ id: "user1", displayName: "Alice", role: "admin" });
    }
  });

  it("role が欠落しているときパースが失敗する（必須フィールド）", () => {
    const result = AuthUserSchema.safeParse({ id: "user1", loginId: "user1", displayName: "Alice" });
    expect(result.success).toBe(false);
  });

  it("role が不正値のときパースが失敗する", () => {
    const result = AuthUserSchema.safeParse({ id: "user1", loginId: "user1", displayName: "Alice", role: "superadmin" });
    expect(result.success).toBe(false);
  });

  it("passwordHash を含んでいても parseStrict しない（余分なフィールドは strip される）", () => {
    const result = AuthUserSchema.safeParse({ id: "user1", loginId: "user1", displayName: "Alice", role: "admin", passwordHash: "secret" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("passwordHash");
    }
  });

  // #49: 自身の Employee を指す employeeId（任意）。
  it("employeeId を付与してもパースが成功する（AC-8）", () => {
    const result = AuthUserSchema.safeParse({ id: "user1", loginId: "user1", displayName: "Alice", role: "admin", employeeId: "emp1" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.employeeId).toBe("emp1");
    }
  });

  it("employeeId を省略してもパースが成功する（AC-8 / 任意フィールド）", () => {
    const result = AuthUserSchema.safeParse({ id: "user1", loginId: "user1", displayName: "Alice", role: "member" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.employeeId).toBeUndefined();
    }
  });

  it("avatarUrl を付与してもパースが成功する（#51）", () => {
    const result = AuthUserSchema.safeParse({
      id: "user1",
      loginId: "user1",
      displayName: "Alice",
      role: "admin",
      avatarUrl: "https://example.com/avatar.png",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.avatarUrl).toBe("https://example.com/avatar.png");
    }
  });

  it("avatarUrl を省略してもパースが成功する（#51 / 任意フィールド）", () => {
    const result = AuthUserSchema.safeParse({ id: "user1", loginId: "user1", displayName: "Alice", role: "member" });
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

  it("displayName が DISPLAY_NAME_MAX_LENGTH 文字ちょうどなら成功する（#91）", () => {
    const result = UpdateProfileSchema.safeParse({ displayName: "a".repeat(DISPLAY_NAME_MAX_LENGTH) });
    expect(result.success).toBe(true);
  });

  it("displayName が DISPLAY_NAME_MAX_LENGTH + 1 文字なら失敗する（#91）", () => {
    const result = UpdateProfileSchema.safeParse({ displayName: "a".repeat(DISPLAY_NAME_MAX_LENGTH + 1) });
    expect(result.success).toBe(false);
  });
});
