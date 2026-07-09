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
    const result = await repo.listWorkersByCommunity({ communityId: community.id });

    expect(result.items.map((w) => w.id).sort()).toEqual(["haru", "ken"]);
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
    const result = await repo.listWorkersByCommunity({ communityId: community.id });

    expect(result.items.map((w) => w.id)).toEqual(["haru"]);
  });

  it("紐づきが無い community では空配列を返す", async () => {
    const community = await prisma.community.create({
      data: { slug: "empty", name: "空", description: "説明" },
    });

    const repo = createPrismaWorkerCommunityRepository(prisma);
    const result = await repo.listWorkersByCommunity({ communityId: community.id });

    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });

  it("limit を指定するとカーソルページネーションできる（id 昇順・#1078）", async () => {
    const community = await prisma.community.create({
      data: { slug: "paged", name: "ページング", description: "説明" },
    });
    await prisma.worker.create({ data: { id: "w1", displayName: "w1" } });
    await prisma.worker.create({ data: { id: "w2", displayName: "w2" } });
    await prisma.worker.create({ data: { id: "w3", displayName: "w3" } });
    await prisma.workerCommunity.createMany({
      data: [
        { workerId: "w1", communityId: community.id },
        { workerId: "w2", communityId: community.id },
        { workerId: "w3", communityId: community.id },
      ],
    });

    const repo = createPrismaWorkerCommunityRepository(prisma);
    const page1 = await repo.listWorkersByCommunity({ communityId: community.id, limit: 2 });
    expect(page1.items.map((w) => w.id)).toEqual(["w1", "w2"]);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await repo.listWorkersByCommunity({
      communityId: community.id,
      limit: 2,
      cursor: page1.nextCursor ?? undefined,
    });
    expect(page2.items.map((w) => w.id)).toEqual(["w3"]);
    expect(page2.nextCursor).toBeNull();
  });

  it("setWorkerCommunities は参加 community を全置換し listCommunityIdsByWorker で取得できる（#490）", async () => {
    const c1 = await prisma.community.create({
      data: { slug: "c1", name: "C1", description: "説明" },
    });
    const c2 = await prisma.community.create({
      data: { slug: "c2", name: "C2", description: "説明" },
    });
    const c3 = await prisma.community.create({
      data: { slug: "c3", name: "C3", description: "説明" },
    });
    await prisma.worker.create({ data: { id: "haru", displayName: "haru" } });
    await prisma.workerCommunity.create({
      data: { workerId: "haru", communityId: c1.id },
    });

    const repo = createPrismaWorkerCommunityRepository(prisma);
    await repo.setWorkerCommunities("haru", [c2.id, c3.id]);

    const result = await repo.listCommunityIdsByWorker("haru");
    expect([...result].sort()).toEqual([c2.id, c3.id].sort());
  });

  it("setWorkerCommunities に空配列を渡すと全解除する（#490）", async () => {
    const c1 = await prisma.community.create({
      data: { slug: "c1", name: "C1", description: "説明" },
    });
    await prisma.worker.create({ data: { id: "haru", displayName: "haru" } });
    await prisma.workerCommunity.create({
      data: { workerId: "haru", communityId: c1.id },
    });

    const repo = createPrismaWorkerCommunityRepository(prisma);
    await repo.setWorkerCommunities("haru", []);

    expect(await repo.listCommunityIdsByWorker("haru")).toEqual([]);
  });

  it("setWorkerCommunities は重複 id を一意化する（#490）", async () => {
    const c1 = await prisma.community.create({
      data: { slug: "c1", name: "C1", description: "説明" },
    });
    await prisma.worker.create({ data: { id: "haru", displayName: "haru" } });

    const repo = createPrismaWorkerCommunityRepository(prisma);
    await repo.setWorkerCommunities("haru", [c1.id, c1.id]);

    expect(await repo.listCommunityIdsByWorker("haru")).toEqual([c1.id]);
  });

  it("listWorkerSummariesByCommunity は community に紐づく有効なワーカーの id/displayName を id 昇順で返す（#1079）", async () => {
    const community = await prisma.community.create({
      data: { slug: "tech", name: "テック", description: "説明" },
    });
    await prisma.worker.create({ data: { id: "ken", displayName: "ken" } });
    await prisma.worker.create({ data: { id: "haru", displayName: "haru" } });
    await prisma.worker.create({
      data: { id: "old", displayName: "old", deletedAt: new Date() },
    });
    await prisma.workerCommunity.createMany({
      data: [
        { workerId: "ken", communityId: community.id },
        { workerId: "haru", communityId: community.id },
        { workerId: "old", communityId: community.id },
      ],
    });

    const repo = createPrismaWorkerCommunityRepository(prisma);
    const result = await repo.listWorkerSummariesByCommunity(community.id);

    expect(result).toEqual([
      { id: "haru", displayName: "haru" },
      { id: "ken", displayName: "ken" },
    ]);
  });

  it("listWorkerSummariesByCommunity は紐づきが無い community では空配列を返す（#1079）", async () => {
    const community = await prisma.community.create({
      data: { slug: "empty", name: "空", description: "説明" },
    });

    const repo = createPrismaWorkerCommunityRepository(prisma);
    expect(await repo.listWorkerSummariesByCommunity(community.id)).toEqual([]);
  });

  it("setCommunityWorkers はコミュニティの所属ワーカーを全置換する（#1079）", async () => {
    const community = await prisma.community.create({
      data: { slug: "tech", name: "テック", description: "説明" },
    });
    await prisma.worker.create({ data: { id: "haru", displayName: "haru" } });
    await prisma.worker.create({ data: { id: "ken", displayName: "ken" } });
    await prisma.workerCommunity.create({
      data: { workerId: "haru", communityId: community.id },
    });

    const repo = createPrismaWorkerCommunityRepository(prisma);
    await repo.setCommunityWorkers(community.id, ["ken"]);

    const result = await repo.listWorkerSummariesByCommunity(community.id);
    expect(result.map((w) => w.id)).toEqual(["ken"]);
  });

  it("setCommunityWorkers に空配列を渡すと全解除する（#1079）", async () => {
    const community = await prisma.community.create({
      data: { slug: "tech", name: "テック", description: "説明" },
    });
    await prisma.worker.create({ data: { id: "haru", displayName: "haru" } });
    await prisma.workerCommunity.create({
      data: { workerId: "haru", communityId: community.id },
    });

    const repo = createPrismaWorkerCommunityRepository(prisma);
    await repo.setCommunityWorkers(community.id, []);

    expect(await repo.listWorkerSummariesByCommunity(community.id)).toEqual([]);
  });

  it("setCommunityWorkers は重複 id を一意化する（#1079）", async () => {
    const community = await prisma.community.create({
      data: { slug: "tech", name: "テック", description: "説明" },
    });
    await prisma.worker.create({ data: { id: "haru", displayName: "haru" } });

    const repo = createPrismaWorkerCommunityRepository(prisma);
    await repo.setCommunityWorkers(community.id, ["haru", "haru"]);

    expect(
      (await repo.listWorkerSummariesByCommunity(community.id)).map((w) => w.id),
    ).toEqual(["haru"]);
  });
});
