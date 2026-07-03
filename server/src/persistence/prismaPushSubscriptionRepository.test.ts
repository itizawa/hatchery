import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createPrismaPushSubscriptionRepository } from "./prismaPushSubscriptionRepository.js";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("createPrismaPushSubscriptionRepository (integration)", () => {
  let prisma: PrismaClient;
  let userId: string;
  let userId2: string;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // onDelete: Cascade により PushSubscription も連鎖削除される
    await prisma.user.deleteMany();
  });

  async function setupFixtures() {
    const u1 = await prisma.user.create({
      data: { email: "push-user-1@example.com", googleId: "push-google-1", displayName: "Push User 1" },
    });
    const u2 = await prisma.user.create({
      data: { email: "push-user-2@example.com", googleId: "push-google-2", displayName: "Push User 2" },
    });
    userId = u1.id;
    userId2 = u2.id;
  }

  describe("upsert", () => {
    it("新規 endpoint の購読が正しく作成される", async () => {
      await setupFixtures();
      const repo = createPrismaPushSubscriptionRepository(prisma);

      const result = await repo.upsert({
        userId,
        endpoint: "https://push.example.com/endpoint-1",
        p256dh: "key-abc",
        auth: "auth-abc",
      });

      expect(result.userId).toBe(userId);
      expect(result.endpoint).toBe("https://push.example.com/endpoint-1");
      expect(result.p256dh).toBe("key-abc");
      expect(result.auth).toBe("auth-abc");
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it("同一 endpoint への再 upsert で p256dh / auth が上書きされる", async () => {
      await setupFixtures();
      const repo = createPrismaPushSubscriptionRepository(prisma);
      const endpoint = "https://push.example.com/endpoint-2";

      await repo.upsert({ userId, endpoint, p256dh: "key-old", auth: "auth-old" });
      const updated = await repo.upsert({ userId, endpoint, p256dh: "key-new", auth: "auth-new" });

      expect(updated.p256dh).toBe("key-new");
      expect(updated.auth).toBe("auth-new");

      const all = await repo.listAll();
      expect(all.filter((s) => s.endpoint === endpoint)).toHaveLength(1);
    });
  });

  describe("delete", () => {
    it("存在する endpoint を削除できる", async () => {
      await setupFixtures();
      const repo = createPrismaPushSubscriptionRepository(prisma);
      const endpoint = "https://push.example.com/endpoint-delete";

      await repo.upsert({ userId, endpoint, p256dh: "key", auth: "auth" });
      await repo.delete(endpoint);

      const all = await repo.listAll();
      expect(all.find((s) => s.endpoint === endpoint)).toBeUndefined();
    });

    it("存在しない endpoint を渡しても例外を投げず正常終了する（P2025 握りつぶし）", async () => {
      await setupFixtures();
      const repo = createPrismaPushSubscriptionRepository(prisma);

      await expect(repo.delete("https://push.example.com/not-exists")).resolves.toBeUndefined();
    });
  });

  describe("deleteByEndpointAndUserId", () => {
    it("対象の endpoint+userId の購読のみ削除し、他ユーザーの購読は残る", async () => {
      await setupFixtures();
      const repo = createPrismaPushSubscriptionRepository(prisma);
      const endpoint = "https://push.example.com/endpoint-shared";

      await repo.upsert({ userId, endpoint, p256dh: "key-1", auth: "auth-1" });
      await repo.upsert({ userId: userId2, endpoint: "https://push.example.com/endpoint-u2", p256dh: "key-2", auth: "auth-2" });

      await repo.deleteByEndpointAndUserId({ endpoint, userId });

      const all = await repo.listAll();
      expect(all.find((s) => s.endpoint === endpoint && s.userId === userId)).toBeUndefined();
      expect(all.find((s) => s.userId === userId2)).toBeDefined();
    });

    it("userId が一致しない場合は削除されない（所有者チェック）", async () => {
      await setupFixtures();
      const repo = createPrismaPushSubscriptionRepository(prisma);
      const endpoint = "https://push.example.com/endpoint-owner";

      await repo.upsert({ userId, endpoint, p256dh: "key", auth: "auth" });
      await repo.deleteByEndpointAndUserId({ endpoint, userId: userId2 });

      const all = await repo.listAll();
      expect(all.find((s) => s.endpoint === endpoint && s.userId === userId)).toBeDefined();
    });
  });

  describe("deleteByUserId", () => {
    it("指定 userId の全購読を削除し、他ユーザーの購読は残る", async () => {
      await setupFixtures();
      const repo = createPrismaPushSubscriptionRepository(prisma);

      await repo.upsert({ userId, endpoint: "https://push.example.com/u1-ep1", p256dh: "k1", auth: "a1" });
      await repo.upsert({ userId, endpoint: "https://push.example.com/u1-ep2", p256dh: "k2", auth: "a2" });
      await repo.upsert({ userId: userId2, endpoint: "https://push.example.com/u2-ep1", p256dh: "k3", auth: "a3" });

      await repo.deleteByUserId(userId);

      const all = await repo.listAll();
      expect(all.filter((s) => s.userId === userId)).toHaveLength(0);
      expect(all.filter((s) => s.userId === userId2)).toHaveLength(1);
    });
  });

  describe("listAll", () => {
    it("登録済みの全購読を返す", async () => {
      await setupFixtures();
      const repo = createPrismaPushSubscriptionRepository(prisma);

      await repo.upsert({ userId, endpoint: "https://push.example.com/list-ep1", p256dh: "k1", auth: "a1" });
      await repo.upsert({ userId: userId2, endpoint: "https://push.example.com/list-ep2", p256dh: "k2", auth: "a2" });

      const all = await repo.listAll();
      expect(all.length).toBeGreaterThanOrEqual(2);
      expect(all.some((s) => s.endpoint === "https://push.example.com/list-ep1")).toBe(true);
      expect(all.some((s) => s.endpoint === "https://push.example.com/list-ep2")).toBe(true);
    });

    it("購読が無い場合は空配列を返す", async () => {
      await setupFixtures();
      const repo = createPrismaPushSubscriptionRepository(prisma);

      const all = await repo.listAll();
      expect(all).toEqual([]);
    });
  });
});
