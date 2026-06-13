import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createPrismaWorkerCommunityRepository } from "./prismaWorkerCommunityRepository.js";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("createPrismaWorkerCommunityRepository (integration)", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.workerCommunity.deleteMany();
    await prisma.community.deleteMany();
    await prisma.worker.deleteMany();
  });

  it("community に紐づく有効なワーカーを返す", async () => {
    const community = await prisma.community.create({
      data: { slug: "tech", name: "テック", description: "説明" },
    });
    await prisma.worker.create({ data: { id: "haru", displayName: "haru" } });
    await prisma.worker.create({ data: { id: "ken", displayName: "ken" } });
    await prisma.workerCommunity.createMany({
      data: [
        { workerId: "haru", communityId: community.id },
        { workerId: "ken", communityId: community.id },
      ],
    });

    const repo = createPrismaWorkerCommunityRepository(prisma);
    const result = await repo.listWorkersByCommunity(community.id);

    expect(result.map((w) => w.id).sort()).toEqual(["haru", "ken"]);
  });

  it("論理削除済みワーカーは紐づいていても除外する", async () => {
    const community = await prisma.community.create({
      data: { slug: "tech", name: "テック", description: "説明" },
    });
    await prisma.worker.create({ data: { id: "haru", displayName: "haru" } });
    await prisma.worker.create({
      data: { id: "old", displayName: "old", deletedAt: new Date() },
    });
    await prisma.workerCommunity.createMany({
      data: [
        { workerId: "haru", communityId: community.id },
        { workerId: "old", communityId: community.id },
      ],
    });

    const repo = createPrismaWorkerCommunityRepository(prisma);
    const result = await repo.listWorkersByCommunity(community.id);

    expect(result.map((w) => w.id)).toEqual(["haru"]);
  });

  it("紐づきが無い community では空配列を返す", async () => {
    const community = await prisma.community.create({
      data: { slug: "empty", name: "空", description: "説明" },
    });

    const repo = createPrismaWorkerCommunityRepository(prisma);
    const result = await repo.listWorkersByCommunity(community.id);

    expect(result).toEqual([]);
  });
});
