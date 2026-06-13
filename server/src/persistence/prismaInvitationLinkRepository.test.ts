import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createPrismaInvitationLinkRepository } from "./prismaInvitationLinkRepository.js";

const DATABASE_URL = process.env.DATABASE_URL;

const HOUR_MS = 60 * 60 * 1000;

function relativeDate(offsetMs: number): Date {
  return new Date(Date.now() + offsetMs);
}

describe.skipIf(!DATABASE_URL)("createPrismaInvitationLinkRepository (integration)", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.invitationLink.deleteMany();
  });

  describe("create", () => {
    it("全フィールドが正確に保存される", async () => {
      const repo = createPrismaInvitationLinkRepository(prisma);
      const expiresAt = relativeDate(HOUR_MS);

      const created = await repo.create({
        token: "token-abc",
        expiresAt,
        createdByUserId: "user-1",
        memo: "テスト用",
      });

      expect(created.token).toBe("token-abc");
      expect(created.expiresAt.getTime()).toBe(expiresAt.getTime());
      expect(created.createdByUserId).toBe("user-1");
      expect(created.memo).toBe("テスト用");
    });

    it("作成直後は usedAt / usedByUserId / revokedAt が null である", async () => {
      const repo = createPrismaInvitationLinkRepository(prisma);

      const created = await repo.create({
        token: "token-abc",
        expiresAt: relativeDate(HOUR_MS),
        createdByUserId: "user-1",
      });

      expect(created.usedAt).toBeNull();
      expect(created.usedByUserId).toBeNull();
      expect(created.revokedAt).toBeNull();
    });

    it("memo 未指定の場合は null になる", async () => {
      const repo = createPrismaInvitationLinkRepository(prisma);

      const created = await repo.create({
        token: "token-abc",
        expiresAt: relativeDate(HOUR_MS),
        createdByUserId: "user-1",
      });

      expect(created.memo).toBeNull();
    });

    it("token はユニーク制約があり、重複するとエラーになる", async () => {
      const repo = createPrismaInvitationLinkRepository(prisma);
      await repo.create({ token: "dup-token", expiresAt: relativeDate(HOUR_MS), createdByUserId: "user-1" });

      await expect(
        repo.create({ token: "dup-token", expiresAt: relativeDate(HOUR_MS), createdByUserId: "user-2" }),
      ).rejects.toThrow();
    });
  });

  describe("list", () => {
    it("全件を createdAt 降順で返す", async () => {
      const repo = createPrismaInvitationLinkRepository(prisma);
      const first = await repo.create({
        token: "token-1",
        expiresAt: relativeDate(HOUR_MS),
        createdByUserId: "user-1",
      });
      await new Promise((r) => setTimeout(r, 100));
      const second = await repo.create({
        token: "token-2",
        expiresAt: relativeDate(HOUR_MS),
        createdByUserId: "user-1",
      });

      const records = await repo.list();

      expect(records).toHaveLength(2);
      expect(records[0].id).toBe(second.id);
      expect(records[1].id).toBe(first.id);
    });

    it("空のリポジトリは空配列を返す", async () => {
      const repo = createPrismaInvitationLinkRepository(prisma);

      const result = await repo.list();

      expect(result).toEqual([]);
    });
  });

  describe("findByToken", () => {
    it("作成済みの token で InvitationLinkRecord を返す", async () => {
      const repo = createPrismaInvitationLinkRepository(prisma);
      const created = await repo.create({
        token: "token-find",
        expiresAt: relativeDate(HOUR_MS),
        createdByUserId: "user-1",
      });

      const found = await repo.findByToken("token-find");

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.token).toBe("token-find");
    });

    it("存在しない token は null を返す", async () => {
      const repo = createPrismaInvitationLinkRepository(prisma);

      const result = await repo.findByToken("unknown-token");

      expect(result).toBeNull();
    });
  });

  describe("revoke", () => {
    it("revokedAt がセットされる", async () => {
      const repo = createPrismaInvitationLinkRepository(prisma);
      const created = await repo.create({
        token: "token-revoke",
        expiresAt: relativeDate(HOUR_MS),
        createdByUserId: "user-1",
      });

      const revoked = await repo.revoke(created.id);

      expect(revoked).not.toBeNull();
      expect(revoked?.revokedAt).toBeInstanceOf(Date);
    });

    it("revoke 後に findByToken で確認すると revokedAt が設定されている", async () => {
      const repo = createPrismaInvitationLinkRepository(prisma);
      const created = await repo.create({
        token: "token-revoke2",
        expiresAt: relativeDate(HOUR_MS),
        createdByUserId: "user-1",
      });
      await repo.revoke(created.id);

      const found = await repo.findByToken("token-revoke2");

      expect(found?.revokedAt).toBeInstanceOf(Date);
    });

    it("存在しない id は null を返す", async () => {
      const repo = createPrismaInvitationLinkRepository(prisma);

      const result = await repo.revoke("not-exists");

      expect(result).toBeNull();
    });
  });

  describe("markUsed", () => {
    it("有効なリンクを使用済みにでき usedAt / usedByUserId がセットされる", async () => {
      const repo = createPrismaInvitationLinkRepository(prisma);
      const created = await repo.create({
        token: "token-use",
        expiresAt: relativeDate(HOUR_MS),
        createdByUserId: "user-1",
      });

      const used = await repo.markUsed(created.id, "user-2");

      expect(used).not.toBeNull();
      expect(used?.usedAt).toBeInstanceOf(Date);
      expect(used?.usedByUserId).toBe("user-2");
    });

    it("使用済みのリンクは再使用できず null を返す（single-use 制約）", async () => {
      const repo = createPrismaInvitationLinkRepository(prisma);
      const created = await repo.create({
        token: "token-single",
        expiresAt: relativeDate(HOUR_MS),
        createdByUserId: "user-1",
      });
      await repo.markUsed(created.id, "user-2");

      const second = await repo.markUsed(created.id, "user-3");

      expect(second).toBeNull();
      const found = await repo.findByToken("token-single");
      expect(found?.usedByUserId).toBe("user-2");
    });

    it("revoke 済みのリンクは markUsed できず null を返す", async () => {
      const repo = createPrismaInvitationLinkRepository(prisma);
      const created = await repo.create({
        token: "token-rv",
        expiresAt: relativeDate(HOUR_MS),
        createdByUserId: "user-1",
      });
      await repo.revoke(created.id);

      const result = await repo.markUsed(created.id, "user-2");

      expect(result).toBeNull();
    });

    it("有効期限切れのリンクは markUsed できず null を返す", async () => {
      const repo = createPrismaInvitationLinkRepository(prisma);
      const created = await repo.create({
        token: "token-exp",
        expiresAt: relativeDate(-HOUR_MS),
        createdByUserId: "user-1",
      });

      const result = await repo.markUsed(created.id, "user-2");

      expect(result).toBeNull();
    });

    it("存在しない id は null を返す", async () => {
      const repo = createPrismaInvitationLinkRepository(prisma);

      const result = await repo.markUsed("not-exists", "user-2");

      expect(result).toBeNull();
    });
  });
});
