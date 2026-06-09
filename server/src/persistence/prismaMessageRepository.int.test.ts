import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaMessageRepository } from "./prismaMessageRepository.js";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("PrismaMessageRepository (統合・要 DATABASE_URL)", () => {
  let prisma: InstanceType<typeof import("@prisma/client").PrismaClient>;
  let repo: PrismaMessageRepository;

  beforeAll(async () => {
    const { PrismaClient } = await import("@prisma/client");
    prisma = new PrismaClient();
    repo = new PrismaMessageRepository(prisma);
    await prisma.message.deleteMany();
  });

  afterAll(async () => {
    await prisma.message.deleteMany();
    await prisma.$disconnect();
  });

  it("createMany で保存し list で順序を保って取得できる", async () => {
    const created = await repo.createMany([
      { createdEmployeeId: "e1", channel: "zatsudan", text: "one" },
      { createdEmployeeId: "e2", channel: "shigoto", text: "two" },
    ]);
    expect(created).toHaveLength(2);
    expect(created[0]?.id).toBeTruthy();
    expect(created[0]?.channel).toBe("zatsudan");
    expect(created[1]?.channel).toBe("shigoto");

    const all = await repo.list();
    const texts = all.map((m) => m.text);
    expect(texts).toContain("one");
    expect(texts).toContain("two");
  });
});
