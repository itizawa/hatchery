import { describe, expect, it } from "vitest";

import { getInvitationStatus } from "./invitation.js";

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
