import { describe, expect, it } from "vitest";
import {
  createInMemoryInvitationLinkRepository,
  toInvitationLinkResponse,
} from "./invitationLinkRepository.js";

const HOUR_MS = 60 * 60 * 1000;

/** 現在から相対オフセット（ms）の Date を返す（フレーク防止のため相対時刻のみ使う）。 */
function relativeDate(offsetMs: number): Date {
  return new Date(Date.now() + offsetMs);
}

describe("createInMemoryInvitationLinkRepository", () => {
  describe("create", () => {
    it("token・expiresAt・createdByUserId・memo を保持して作成できる", async () => {
      const repo = createInMemoryInvitationLinkRepository();
      const expiresAt = relativeDate(HOUR_MS);
      const record = await repo.create({
        token: "token-1",
        expiresAt,
        createdByUserId: "user-1",
        memo: "テスト用の招待リンク",
      });
      expect(record.token).toBe("token-1");
      expect(record.expiresAt).toEqual(expiresAt);
      expect(record.createdByUserId).toBe("user-1");
      expect(record.memo).toBe("テスト用の招待リンク");
    });

    it("memo 未指定の場合は null になる", async () => {
      const repo = createInMemoryInvitationLinkRepository();
      const record = await repo.create({
        token: "token-1",
        expiresAt: relativeDate(HOUR_MS),
        createdByUserId: "user-1",
      });
      expect(record.memo).toBeNull();
    });

    it("作成直後は usedAt・usedByUserId・revokedAt が null である", async () => {
      const repo = createInMemoryInvitationLinkRepository();
      const record = await repo.create({
        token: "token-1",
        expiresAt: relativeDate(HOUR_MS),
        createdByUserId: "user-1",
      });
      expect(record.usedAt).toBeNull();
      expect(record.usedByUserId).toBeNull();
      expect(record.revokedAt).toBeNull();
    });

    it("複数作成しても id が重複しない", async () => {
      const repo = createInMemoryInvitationLinkRepository();
      const first = await repo.create({
        token: "token-1",
        expiresAt: relativeDate(HOUR_MS),
        createdByUserId: "user-1",
      });
      const second = await repo.create({
        token: "token-2",
        expiresAt: relativeDate(HOUR_MS),
        createdByUserId: "user-1",
      });
      expect(first.id).not.toBe(second.id);
    });
  });

  describe("findByToken", () => {
    it("作成済みの token で取得できる", async () => {
      const repo = createInMemoryInvitationLinkRepository();
      const created = await repo.create({
        token: "token-1",
        expiresAt: relativeDate(HOUR_MS),
        createdByUserId: "user-1",
      });
      const found = await repo.findByToken("token-1");
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.token).toBe("token-1");
    });

    it("未知の token は null を返す", async () => {
      const repo = createInMemoryInvitationLinkRepository();
      await repo.create({
        token: "token-1",
        expiresAt: relativeDate(HOUR_MS),
        createdByUserId: "user-1",
      });
      const found = await repo.findByToken("unknown-token");
      expect(found).toBeNull();
    });

    it("返却値はコピーであり、書き換えても内部状態に影響しない", async () => {
      const repo = createInMemoryInvitationLinkRepository();
      await repo.create({
        token: "token-1",
        expiresAt: relativeDate(HOUR_MS),
        createdByUserId: "user-1",
      });
      const found = await repo.findByToken("token-1");
      expect(found).not.toBeNull();
      if (found) found.memo = "改ざん";
      const foundAgain = await repo.findByToken("token-1");
      expect(foundAgain?.memo).toBeNull();
    });
  });

  describe("list", () => {
    it("全件を createdAt 降順で返す", async () => {
      const repo = createInMemoryInvitationLinkRepository();
      const first = await repo.create({
        token: "token-1",
        expiresAt: relativeDate(HOUR_MS),
        createdByUserId: "user-1",
      });
      const second = await repo.create({
        token: "token-2",
        expiresAt: relativeDate(HOUR_MS),
        createdByUserId: "user-1",
      });
      const records = await repo.list();
      expect(records).toHaveLength(2);
      // createdAt が同一ミリ秒になり得るため、降順（後勝ち）または同時刻の安定性のみを検証する
      const times = records.map((r) => r.createdAt.getTime());
      expect(times[0]).toBeGreaterThanOrEqual(times[1] ?? 0);
      const ids = records.map((r) => r.id);
      expect(ids).toContain(first.id);
      expect(ids).toContain(second.id);
    });

    it("空のリポジトリは空配列を返す", async () => {
      const repo = createInMemoryInvitationLinkRepository();
      await expect(repo.list()).resolves.toEqual([]);
    });
  });

  describe("revoke", () => {
    it("revokedAt がセットされる", async () => {
      const repo = createInMemoryInvitationLinkRepository();
      const created = await repo.create({
        token: "token-1",
        expiresAt: relativeDate(HOUR_MS),
        createdByUserId: "user-1",
      });
      const revoked = await repo.revoke(created.id);
      expect(revoked).not.toBeNull();
      expect(revoked?.revokedAt).toBeInstanceOf(Date);
    });

    it("存在しない id は null を返す", async () => {
      const repo = createInMemoryInvitationLinkRepository();
      await expect(repo.revoke("not-exists")).resolves.toBeNull();
    });
  });

  describe("markUsed", () => {
    it("有効なリンクを使用済みにでき、usedAt・usedByUserId がセットされる", async () => {
      const repo = createInMemoryInvitationLinkRepository();
      const created = await repo.create({
        token: "token-1",
        expiresAt: relativeDate(HOUR_MS),
        createdByUserId: "user-1",
      });
      const used = await repo.markUsed(created.id, "user-2");
      expect(used).not.toBeNull();
      expect(used?.usedAt).toBeInstanceOf(Date);
      expect(used?.usedByUserId).toBe("user-2");
    });

    it("使用済みのリンクは再使用できず null を返す", async () => {
      const repo = createInMemoryInvitationLinkRepository();
      const created = await repo.create({
        token: "token-1",
        expiresAt: relativeDate(HOUR_MS),
        createdByUserId: "user-1",
      });
      await repo.markUsed(created.id, "user-2");
      const second = await repo.markUsed(created.id, "user-3");
      expect(second).toBeNull();
      // 最初の使用者の情報が保持されること
      const found = await repo.findByToken("token-1");
      expect(found?.usedByUserId).toBe("user-2");
    });

    it("revoke 済みのリンクは markUsed できず null を返す", async () => {
      const repo = createInMemoryInvitationLinkRepository();
      const created = await repo.create({
        token: "token-1",
        expiresAt: relativeDate(HOUR_MS),
        createdByUserId: "user-1",
      });
      await repo.revoke(created.id);
      await expect(repo.markUsed(created.id, "user-2")).resolves.toBeNull();
    });

    it("有効期限切れ（expiresAt が過去）のリンクは markUsed できず null を返す", async () => {
      const repo = createInMemoryInvitationLinkRepository();
      const created = await repo.create({
        token: "token-1",
        expiresAt: relativeDate(-HOUR_MS),
        createdByUserId: "user-1",
      });
      await expect(repo.markUsed(created.id, "user-2")).resolves.toBeNull();
    });

    it("存在しない id は null を返す", async () => {
      const repo = createInMemoryInvitationLinkRepository();
      await expect(repo.markUsed("not-exists", "user-2")).resolves.toBeNull();
    });
  });
});

describe("toInvitationLinkResponse", () => {
  const baseRecord = {
    id: "invitation-1",
    token: "token-1",
    expiresAt: new Date("2026-01-01T00:00:00Z"),
    usedAt: null,
    usedByUserId: null,
    revokedAt: null,
    createdByUserId: "user-1",
    memo: "memo",
    createdAt: new Date("2025-12-01T00:00:00Z"),
  };

  it("有効期限内・未使用・未失効なら status は active（固定 now 注入）", () => {
    const now = new Date("2025-12-31T23:59:59Z");
    expect(toInvitationLinkResponse(baseRecord, now).status).toBe("active");
  });

  it("expiresAt が過去なら status は expired", () => {
    const now = new Date("2026-01-02T00:00:00Z");
    expect(toInvitationLinkResponse(baseRecord, now).status).toBe("expired");
  });

  it("expiresAt と now が同時刻（境界）は expired と判定する", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(toInvitationLinkResponse(baseRecord, now).status).toBe("expired");
  });

  it("usedAt がある場合は status が used（期限より優先）", () => {
    const now = new Date("2026-01-02T00:00:00Z");
    const record = { ...baseRecord, usedAt: new Date("2025-12-15T00:00:00Z") };
    expect(toInvitationLinkResponse(record, now).status).toBe("used");
  });

  it("revokedAt がある場合は status が revoked（used より優先）", () => {
    const now = new Date("2026-01-02T00:00:00Z");
    const record = {
      ...baseRecord,
      usedAt: new Date("2025-12-15T00:00:00Z"),
      revokedAt: new Date("2025-12-10T00:00:00Z"),
    };
    expect(toInvitationLinkResponse(record, now).status).toBe("revoked");
  });

  it("内部情報（usedByUserId・createdByUserId）をレスポンスに含めない", () => {
    const now = new Date("2025-12-31T00:00:00Z");
    const response = toInvitationLinkResponse(
      { ...baseRecord, usedByUserId: "user-2" },
      now,
    );
    expect(response).not.toHaveProperty("usedByUserId");
    expect(response).not.toHaveProperty("createdByUserId");
    expect(response.memo).toBe("memo");
  });
});
