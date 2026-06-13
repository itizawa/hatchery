import { describe, expect, it } from "vitest";

import {
  AuthUserSchema,
  AVATAR_URL_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  UpdateProfileSchema,
  UserRoleSchema,
  isAdmin,
} from "./auth.js";

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
    expect(isAdmin({ role: "admin" })).toBe(true);
  });

  it("role が 'member' のとき false を返す", () => {
    expect(isAdmin({ role: "member" })).toBe(false);
  });
});

describe("AuthUserSchema (#455 Google-only auth)", () => {
  it("id / email / displayName / role（admin）でパースが成功する", () => {
    const result = AuthUserSchema.safeParse({
      id: "user1",
      email: "alice@example.com",
      displayName: "Alice",
      role: "admin",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ id: "user1", email: "alice@example.com", displayName: "Alice", role: "admin" });
    }
  });

  it("email が欠落しているとき失敗する（必須フィールド）", () => {
    const result = AuthUserSchema.safeParse({ id: "user1", displayName: "Alice", role: "admin" });
    expect(result.success).toBe(false);
  });

  it("email が有効なメールアドレス形式でないとき失敗する", () => {
    const result = AuthUserSchema.safeParse({ id: "user1", email: "not-an-email", displayName: "Alice", role: "admin" });
    expect(result.success).toBe(false);
  });

  it("email が EMAIL_MAX_LENGTH + 1 文字のとき失敗する", () => {
    const longEmail = "a".repeat(EMAIL_MAX_LENGTH - 4) + "@b.co"; // 255 chars > 254
    const result = AuthUserSchema.safeParse({ id: "user1", email: longEmail, displayName: "Alice", role: "admin" });
    expect(result.success).toBe(false);
  });

  it("role が欠落しているときパースが失敗する（必須フィールド）", () => {
    const result = AuthUserSchema.safeParse({ id: "user1", email: "a@b.com", displayName: "Alice" });
    expect(result.success).toBe(false);
  });

  it("role が不正値のときパースが失敗する", () => {
    const result = AuthUserSchema.safeParse({ id: "user1", email: "a@b.com", displayName: "Alice", role: "superadmin" });
    expect(result.success).toBe(false);
  });

  it("passwordHash を含んでいても余分なフィールドは strip される", () => {
    const result = AuthUserSchema.safeParse({ id: "user1", email: "a@b.com", displayName: "Alice", role: "admin", passwordHash: "secret" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty("passwordHash");
  });

  it("avatarUrl を付与してもパースが成功する（#51）", () => {
    const result = AuthUserSchema.safeParse({
      id: "user1",
      email: "alice@example.com",
      displayName: "Alice",
      role: "admin",
      avatarUrl: "https://example.com/avatar.png",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.avatarUrl).toBe("https://example.com/avatar.png");
  });

  it("avatarUrl を省略してもパースが成功する（#51 / 任意フィールド）", () => {
    const result = AuthUserSchema.safeParse({ id: "user1", email: "a@b.com", displayName: "Alice", role: "member" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.avatarUrl).toBeUndefined();
  });
});

describe("LoginRequestSchema の廃止 (#455)", () => {
  it("LoginRequestSchema は common から export されていない", async () => {
    const authModule = await import("./auth.js");
    expect("LoginRequestSchema" in authModule).toBe(false);
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
    if (result.success) expect(result.data.avatarUrl).toBe("https://example.com/avatar.png");
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
    const result = UpdateProfileSchema.safeParse({ displayName: "Alice", avatarUrl: "not-a-url" });
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

  it("avatarUrl が AVATAR_URL_MAX_LENGTH 文字ちょうどなら成功する（#202）", () => {
    const base = "https://example.com/";
    const path = "a".repeat(AVATAR_URL_MAX_LENGTH - base.length);
    const result = UpdateProfileSchema.safeParse({ displayName: "Alice", avatarUrl: base + path });
    expect(result.success).toBe(true);
  });

  it("avatarUrl が AVATAR_URL_MAX_LENGTH + 1 文字なら失敗する（#202）", () => {
    const base = "https://example.com/";
    const path = "a".repeat(AVATAR_URL_MAX_LENGTH - base.length + 1);
    const result = UpdateProfileSchema.safeParse({ displayName: "Alice", avatarUrl: base + path });
    expect(result.success).toBe(false);
  });
});
