import { describe, expect, it } from "vitest";

import { AcceptInvitationSchema, getInvitationStatus } from "./invitation.js";

describe("getInvitationStatus", () => {
  const now = new Date("2026-06-05T12:00:00Z");
  const future = new Date("2026-06-10T12:00:00Z");
  const past = new Date("2026-06-01T12:00:00Z");

  it("revokedAt があれば revoked", () => {
    expect(
      getInvitationStatus({ revokedAt: now, usedAt: null, expiresAt: future }, now),
    ).toBe("revoked");
  });

  it("usedAt があれば used (revokedAt なし)", () => {
    expect(
      getInvitationStatus({ revokedAt: null, usedAt: now, expiresAt: future }, now),
    ).toBe("used");
  });

  it("expiresAt が現在以前なら expired (revokedAt/usedAt なし)", () => {
    expect(
      getInvitationStatus({ revokedAt: null, usedAt: null, expiresAt: past }, now),
    ).toBe("expired");
  });

  it("expiresAt が現在と等しければ expired", () => {
    expect(
      getInvitationStatus({ revokedAt: null, usedAt: null, expiresAt: now }, now),
    ).toBe("expired");
  });

  it("全て条件を満たさなければ active", () => {
    expect(
      getInvitationStatus({ revokedAt: null, usedAt: null, expiresAt: future }, now),
    ).toBe("active");
  });

  it("revokedAt と usedAt が両方ある場合は revoked が優先", () => {
    expect(
      getInvitationStatus({ revokedAt: now, usedAt: now, expiresAt: past }, now),
    ).toBe("revoked");
  });

  it("usedAt があり期限切れでも used が優先 (revokedAt なし)", () => {
    expect(
      getInvitationStatus({ revokedAt: null, usedAt: now, expiresAt: past }, now),
    ).toBe("used");
  });
});

describe("AcceptInvitationSchema (#132)", () => {
  const valid = { id: "user01", displayName: "テストユーザー", password: "password123" };

  it("有効なデータはパースできる", () => {
    expect(AcceptInvitationSchema.safeParse(valid).success).toBe(true);
  });

  it("id が空文字列の場合は失敗", () => {
    expect(AcceptInvitationSchema.safeParse({ ...valid, id: "" }).success).toBe(false);
  });

  it("id が 50 文字を超えると失敗", () => {
    expect(AcceptInvitationSchema.safeParse({ ...valid, id: "a".repeat(51) }).success).toBe(false);
  });

  it("id が 50 文字ちょうどは成功", () => {
    expect(AcceptInvitationSchema.safeParse({ ...valid, id: "a".repeat(50) }).success).toBe(true);
  });

  it("displayName が空文字列の場合は失敗", () => {
    expect(AcceptInvitationSchema.safeParse({ ...valid, displayName: "" }).success).toBe(false);
  });

  it("displayName が 100 文字を超えると失敗", () => {
    expect(AcceptInvitationSchema.safeParse({ ...valid, displayName: "a".repeat(101) }).success).toBe(false);
  });

  it("password が 7 文字以下の場合は失敗", () => {
    expect(AcceptInvitationSchema.safeParse({ ...valid, password: "short12" }).success).toBe(false);
  });

  it("password が 8 文字以上の場合は成功", () => {
    expect(AcceptInvitationSchema.safeParse({ ...valid, password: "pass1234" }).success).toBe(true);
  });

  it("password が 100 文字を超えると失敗", () => {
    expect(AcceptInvitationSchema.safeParse({ ...valid, password: "a".repeat(101) }).success).toBe(false);
  });
});
