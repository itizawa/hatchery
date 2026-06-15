import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createPrismaWorldStateRepository } from "./prismaWorldStateRepository.js";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("createPrismaWorldStateRepository (integration)", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.worldState.deleteMany();
  });

  describe("get", () => {
    it("WorldState が存在しない場合 null を返す", async () => {
      const repo = createPrismaWorldStateRepository(prisma);

      const result = await repo.get();

      expect(result).toBeNull();
    });

    it("upsert 後に get で同じ内容を取得できる", async () => {
      const repo = createPrismaWorldStateRepository(prisma);
      await repo.upsert({ summaryVersion: 1, workerStates: {} });

      const result = await repo.get();

      expect(result).not.toBeNull();
      expect(result?.summaryVersion).toBe(1);
    });
  });

  describe("upsert", () => {
    it("新規作成時に id='singleton' の WorldState を返す", async () => {
      const repo = createPrismaWorldStateRepository(prisma);

      const result = await repo.upsert({ summaryVersion: 0, workerStates: {} });

      expect(result.id).toBe("singleton");
      expect(result.summaryVersion).toBe(0);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it("既存の WorldState を更新する（summaryVersion が変わる）", async () => {
      const repo = createPrismaWorldStateRepository(prisma);
      await repo.upsert({ summaryVersion: 1, workerStates: {} });

      const updated = await repo.upsert({ summaryVersion: 2, workerStates: {} });

      expect(updated.summaryVersion).toBe(2);

      const retrieved = await repo.get();
      expect(retrieved?.summaryVersion).toBe(2);
    });

    it("workerStates の空オブジェクトが保存・取得できる", async () => {
      const repo = createPrismaWorldStateRepository(prisma);

      await repo.upsert({ summaryVersion: 0, workerStates: {} });
      const result = await repo.get();

      expect(result?.workerStates).toEqual({});
    });

    it("workerStates の複数キーが往復して取得できる", async () => {
      const repo = createPrismaWorldStateRepository(prisma);
      const workerStates = {
        "worker-001": { lastAppearedSlotKey: "2026-01-01T09:00:00Z" },
        "worker-002": { lastAppearedSlotKey: "2026-01-02T12:00:00Z" },
      };

      await repo.upsert({ summaryVersion: 1, workerStates });
      const result = await repo.get();

      expect(result?.workerStates["worker-001"]?.lastAppearedSlotKey).toBe(
        "2026-01-01T09:00:00Z",
      );
      expect(result?.workerStates["worker-002"]?.lastAppearedSlotKey).toBe(
        "2026-01-02T12:00:00Z",
      );
    });
  });
});
