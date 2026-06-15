import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createPrismaBatchRunLogRepository } from "./prismaBatchRunLogRepository.js";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("createPrismaBatchRunLogRepository (integration)", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.batchRunLog.deleteMany();
  });

  describe("create", () => {
    it("id と executedAt が自動付与される", async () => {
      const repo = createPrismaBatchRunLogRepository(prisma);

      const log = await repo.create({
        status: "success",
        messageCount: 5,
        errorMessage: null,
        errorCode: null,
      });

      expect(log.id).toBeDefined();
      expect(log.executedAt).toBeInstanceOf(Date);
    });

    it("status='success' で全フィールドが正確に保存される", async () => {
      const repo = createPrismaBatchRunLogRepository(prisma);

      const log = await repo.create({
        status: "success",
        messageCount: 10,
        errorMessage: null,
        errorCode: null,
      });

      expect(log.status).toBe("success");
      expect(log.messageCount).toBe(10);
      expect(log.errorMessage).toBeNull();
      expect(log.errorCode).toBeNull();
    });

    it("status='failure' + errorMessage + errorCode が保存される", async () => {
      const repo = createPrismaBatchRunLogRepository(prisma);

      const log = await repo.create({
        status: "failure",
        messageCount: 0,
        errorMessage: "API タイムアウト",
        errorCode: "TIMEOUT",
      });

      expect(log.status).toBe("failure");
      expect(log.messageCount).toBe(0);
      expect(log.errorMessage).toBe("API タイムアウト");
      expect(log.errorCode).toBe("TIMEOUT");
    });
  });

  describe("findRecent", () => {
    it("executedAt 降順で最大 limit 件取得する", async () => {
      const repo = createPrismaBatchRunLogRepository(prisma);
      await repo.create({ status: "success", messageCount: 1, errorMessage: null, errorCode: null });
      await new Promise((r) => setTimeout(r, 100));
      await repo.create({ status: "success", messageCount: 2, errorMessage: null, errorCode: null });
      await new Promise((r) => setTimeout(r, 100));
      await repo.create({ status: "success", messageCount: 3, errorMessage: null, errorCode: null });

      const logs = await repo.findRecent(2);

      expect(logs).toHaveLength(2);
      expect(logs[0].messageCount).toBe(3);
      expect(logs[1].messageCount).toBe(2);
    });

    it("limit より件数が少ない場合は全件返す", async () => {
      const repo = createPrismaBatchRunLogRepository(prisma);
      await repo.create({ status: "success", messageCount: 1, errorMessage: null, errorCode: null });

      const logs = await repo.findRecent(100);

      expect(logs).toHaveLength(1);
    });

    it("空の場合は空配列を返す", async () => {
      const repo = createPrismaBatchRunLogRepository(prisma);

      const result = await repo.findRecent(10);

      expect(result).toEqual([]);
    });
  });
});
