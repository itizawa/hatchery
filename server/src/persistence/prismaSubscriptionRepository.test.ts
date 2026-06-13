import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createPrismaCommunityRepository } from "./prismaCommunityRepository.js";
import { createPrismaSubscriptionRepository } from "./prismaSubscriptionRepository.js";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("createPrismaSubscriptionRepository (integration)", () => {
  let prisma: PrismaClient;
  let userId: string;
  let userId2: string;
  let communityId: string;
  let communityId2: string;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.user.deleteMany();
    await prisma.community.deleteMany();
  });

  async function setupFixtures() {
    const u1 = await prisma.user.create({
      data: { loginId: "sub-user-1", displayName: "User 1" },
    });
    const u2 = await prisma.user.create({
      data: { loginId: "sub-user-2", displayName: "User 2" },
    });
    userId = u1.id;
    userId2 = u2.id;

    const communityRepo = createPrismaCommunityRepository(prisma);
    const c1 = await communityRepo.create({ slug: "sub-tech", name: "Tech", description: "Tech community" });
    const c2 = await communityRepo.create({ slug: "sub-daily", name: "Daily", description: "Daily community" });
    communityId = c1.id;
    communityId2 = c2.id;
  }

  describe("add", () => {
    it("購読を追加でき listCommunityIdsByUser に反映される", async () => {
      await setupFixtures();
      const repo = createPrismaSubscriptionRepository(prisma);

      await repo.add(userId, communityId);
      const ids = await repo.listCommunityIdsByUser(userId);

      expect(ids).toContain(communityId);
    });

    it("既に購読済みの場合は重複しない（upsert）", async () => {
      await setupFixtures();
      const repo = createPrismaSubscriptionRepository(prisma);

      await repo.add(userId, communityId);
      await repo.add(userId, communityId);
      const ids = await repo.listCommunityIdsByUser(userId);

      expect(ids).toHaveLength(1);
    });
  });

  describe("remove", () => {
    it("購読を解除でき listCommunityIdsByUser から消える", async () => {
      await setupFixtures();
      const repo = createPrismaSubscriptionRepository(prisma);

      await repo.add(userId, communityId);
      await repo.remove(userId, communityId);
      const ids = await repo.listCommunityIdsByUser(userId);

      expect(ids).toHaveLength(0);
    });

    it("存在しない購読の解除は何もしない（エラーなし）", async () => {
      await setupFixtures();
      const repo = createPrismaSubscriptionRepository(prisma);

      await expect(repo.remove(userId, communityId)).resolves.toBeUndefined();
    });
  });

  describe("listCommunityIdsByUser", () => {
    it("ユーザーの購読コミュニティ一覧を返す（他ユーザーは含まない）", async () => {
      await setupFixtures();
      const repo = createPrismaSubscriptionRepository(prisma);

      await repo.add(userId, communityId);
      await repo.add(userId, communityId2);
      await repo.add(userId2, communityId);

      const ids = await repo.listCommunityIdsByUser(userId);

      expect(ids).toHaveLength(2);
      expect(ids).toContain(communityId);
      expect(ids).toContain(communityId2);
    });

    it("購読がないとき空配列を返す", async () => {
      await setupFixtures();
      const repo = createPrismaSubscriptionRepository(prisma);

      const ids = await repo.listCommunityIdsByUser(userId);

      expect(ids).toEqual([]);
    });
  });

  describe("hasSubscription", () => {
    it("購読済みの場合 true を返す", async () => {
      await setupFixtures();
      const repo = createPrismaSubscriptionRepository(prisma);

      await repo.add(userId, communityId);
      const result = await repo.hasSubscription(userId, communityId);

      expect(result).toBe(true);
    });

    it("未購読の場合 false を返す", async () => {
      await setupFixtures();
      const repo = createPrismaSubscriptionRepository(prisma);

      const result = await repo.hasSubscription(userId, communityId);

      expect(result).toBe(false);
    });

    it("解除後は false を返す", async () => {
      await setupFixtures();
      const repo = createPrismaSubscriptionRepository(prisma);

      await repo.add(userId, communityId);
      await repo.remove(userId, communityId);
      const result = await repo.hasSubscription(userId, communityId);

      expect(result).toBe(false);
    });
  });
});
