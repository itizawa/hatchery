import { afterAll, beforeAll, describe, expect, it } from "vitest";

// #49: Worker の isBot 既定値と userId による User との 1:1 リレーションを実 DB で検証する。
// #329: Employee → Worker リネーム後も同等の制約が維持されることを確認する。
// DATABASE_URL が無い環境（CI 既定）ではスキップする（prismaMessageRepository.int.test.ts と同方針）

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("Worker isBot / userId リレーション（統合・要 DATABASE_URL）", () => {
  let prisma: InstanceType<typeof import("@prisma/client").PrismaClient>;

  beforeAll(async () => {
    const { PrismaClient } = await import("@prisma/client");
    prisma = new PrismaClient();
    await prisma.worker.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.worker.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  it("isBot を省略すると false が既定で入る", async () => {
    const w = await prisma.worker.create({
      data: { id: "ai-1", displayName: "AI 1" },
    });
    expect(w.isBot).toBe(false);
    expect(w.userId).toBeNull();
  });

  it("userId で User と 1:1 に紐づけられる", async () => {
    const user = await prisma.user.create({
      data: { id: "u-1", loginId: "u-1", displayName: "User 1", passwordHash: "x" },
    });
    const owned = await prisma.worker.create({
      data: { id: "owned-1", displayName: "Owned 1", isBot: false, userId: user.id },
    });
    expect(owned.userId).toBe("u-1");

    const joined = await prisma.user.findUnique({
      where: { id: "u-1" },
      include: { worker: true },
    });
    expect(joined?.worker?.id).toBe("owned-1");
  });

  it("同一 userId の Worker を 2 つ作ると一意制約で失敗する", async () => {
    await prisma.user.create({
      data: { id: "u-2", loginId: "u-2", displayName: "User 2", passwordHash: "x" },
    });
    await prisma.worker.create({
      data: { id: "owned-2a", displayName: "Owned 2a", userId: "u-2" },
    });
    await expect(
      prisma.worker.create({
        data: { id: "owned-2b", displayName: "Owned 2b", userId: "u-2" },
      }),
    ).rejects.toThrow();
  });
});
