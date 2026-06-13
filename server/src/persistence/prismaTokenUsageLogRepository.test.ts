import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createPrismaTokenUsageLogRepository } from "./prismaTokenUsageLogRepository.js";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("createPrismaTokenUsageLogRepository (integration)", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.tokenUsageLog.deleteMany();
  });

  describe("create", () => {
    it("id と occurredAt が付与され全フィールドが正確に保存される", async () => {
      const repo = createPrismaTokenUsageLogRepository(prisma);

      const log = await repo.create({
        model: "claude-haiku-4-5",
        inputTokens: 100,
        outputTokens: 50,
        batchRunLogId: null,
      });

      expect(log.id).toBeDefined();
      expect(log.occurredAt).toBeInstanceOf(Date);
      expect(log.model).toBe("claude-haiku-4-5");
      expect(log.inputTokens).toBe(100);
      expect(log.outputTokens).toBe(50);
      expect(log.batchRunLogId).toBeNull();
    });

    it("batchRunLogId あり / なし両方保存できる", async () => {
      const repo = createPrismaTokenUsageLogRepository(prisma);

      const withBatch = await repo.create({
        model: "claude-sonnet-4-6",
        inputTokens: 200,
        outputTokens: 100,
        batchRunLogId: "batch-001",
      });
      const withoutBatch = await repo.create({
        model: "claude-haiku-4-5",
        inputTokens: 50,
        outputTokens: 25,
        batchRunLogId: null,
      });

      expect(withBatch.batchRunLogId).toBe("batch-001");
      expect(withoutBatch.batchRunLogId).toBeNull();
    });
  });

  describe("findRecent", () => {
    it("occurredAt 降順で最大 limit 件取得する", async () => {
      const repo = createPrismaTokenUsageLogRepository(prisma);
      await repo.create({ model: "m", inputTokens: 1, outputTokens: 1, batchRunLogId: null });
      await new Promise((r) => setTimeout(r, 100));
      await repo.create({ model: "m", inputTokens: 2, outputTokens: 2, batchRunLogId: null });
      await new Promise((r) => setTimeout(r, 100));
      await repo.create({ model: "m", inputTokens: 3, outputTokens: 3, batchRunLogId: null });

      const logs = await repo.findRecent(2);

      expect(logs).toHaveLength(2);
      expect(logs[0].inputTokens).toBe(3);
      expect(logs[1].inputTokens).toBe(2);
    });

    it("空のリポジトリは空配列を返す", async () => {
      const repo = createPrismaTokenUsageLogRepository(prisma);

      const result = await repo.findRecent(10);

      expect(result).toEqual([]);
    });

    it("limit より件数が少ない場合は全件返す", async () => {
      const repo = createPrismaTokenUsageLogRepository(prisma);
      await repo.create({ model: "m", inputTokens: 10, outputTokens: 5, batchRunLogId: null });

      const logs = await repo.findRecent(100);

      expect(logs).toHaveLength(1);
    });
  });

  describe("summarize", () => {
    it("全期間のトークン使用量を集計する", async () => {
      const repo = createPrismaTokenUsageLogRepository(prisma);
      await repo.create({ model: "m", inputTokens: 100, outputTokens: 50, batchRunLogId: null });
      await repo.create({ model: "m", inputTokens: 200, outputTokens: 100, batchRunLogId: null });

      const summary = await repo.summarize();

      expect(summary.totalInputTokens).toBe(300);
      expect(summary.totalOutputTokens).toBe(150);
      expect(summary.totalTokens).toBe(450);
    });

    it("ログなしの場合はすべて 0 を返す", async () => {
      const repo = createPrismaTokenUsageLogRepository(prisma);

      const summary = await repo.summarize();

      expect(summary.totalInputTokens).toBe(0);
      expect(summary.totalOutputTokens).toBe(0);
      expect(summary.totalTokens).toBe(0);
    });
  });
});
