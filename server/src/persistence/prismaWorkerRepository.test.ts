import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createPrismaWorkerRepository } from "./prismaWorkerRepository.js";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("createPrismaWorkerRepository (integration)", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.worker.deleteMany();
  });

  describe("create", () => {
    it("入力どおりの WorkerRecord を返す（imageUrl / deletedAt は null）", async () => {
      const repo = createPrismaWorkerRepository(prisma);
      const created = await repo.create({
        id: "worker-new",
        displayName: "新人ワーカー",
        role: "engineer",
        personality: "冷静沈着",
      });

      expect(created.id).toBe("worker-new");
      expect(created.displayName).toBe("新人ワーカー");
      expect(created.role).toBe("engineer");
      expect(created.personality).toBe("冷静沈着");
      expect(created.imageUrl).toBeNull();
      expect(created.deletedAt).toBeNull();
    });

    it("role / personality 省略時は null になる", async () => {
      const repo = createPrismaWorkerRepository(prisma);
      const created = await repo.create({ id: "worker-min", displayName: "最小ワーカー" });

      expect(created.role).toBeNull();
      expect(created.personality).toBeNull();
    });
  });

  describe("findById", () => {
    it("存在する id で WorkerRecord を返す", async () => {
      const repo = createPrismaWorkerRepository(prisma);
      await repo.create({ id: "worker-1", displayName: "ワーカー1" });

      const result = await repo.findById("worker-1");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("worker-1");
      expect(result?.displayName).toBe("ワーカー1");
    });

    it("存在しない id は null を返す", async () => {
      const repo = createPrismaWorkerRepository(prisma);

      const result = await repo.findById("not-exists");

      expect(result).toBeNull();
    });

    it("論理削除済みの worker は null を返す", async () => {
      const repo = createPrismaWorkerRepository(prisma);
      await repo.create({ id: "worker-del", displayName: "削除対象" });
      await repo.softDelete("worker-del");

      const result = await repo.findById("worker-del");

      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("displayName / role / personality が反映される", async () => {
      const repo = createPrismaWorkerRepository(prisma);
      await repo.create({
        id: "worker-1",
        displayName: "元の名前",
        role: "engineer",
        personality: "冷静",
      });

      const updated = await repo.update("worker-1", {
        displayName: "新しい名前",
        role: "manager",
        personality: "情熱的",
      });

      expect(updated?.displayName).toBe("新しい名前");
      expect(updated?.role).toBe("manager");
      expect(updated?.personality).toBe("情熱的");
    });

    it("未指定のフィールドは変更されない", async () => {
      const repo = createPrismaWorkerRepository(prisma);
      await repo.create({ id: "worker-1", displayName: "元の名前", role: "engineer" });

      const updated = await repo.update("worker-1", { displayName: "改名のみ" });

      expect(updated?.displayName).toBe("改名のみ");
      expect(updated?.role).toBe("engineer");
    });

    it("存在しない id は null を返す", async () => {
      const repo = createPrismaWorkerRepository(prisma);

      const result = await repo.update("not-exists", { displayName: "誰でもない" });

      expect(result).toBeNull();
    });

    it("論理削除済みの worker は更新できず null を返す", async () => {
      const repo = createPrismaWorkerRepository(prisma);
      await repo.create({ id: "worker-del", displayName: "削除対象" });
      await repo.softDelete("worker-del");

      const result = await repo.update("worker-del", { displayName: "復活させない" });

      expect(result).toBeNull();
    });
  });

  describe("listByIds", () => {
    it("指定した id の worker を返す", async () => {
      const repo = createPrismaWorkerRepository(prisma);
      await repo.create({ id: "w1", displayName: "A" });
      await repo.create({ id: "w2", displayName: "B" });
      await repo.create({ id: "w3", displayName: "C" });

      const result = await repo.listByIds(["w1", "w3"]);

      expect(result.map((w) => w.id)).toContain("w1");
      expect(result.map((w) => w.id)).toContain("w3");
      expect(result.map((w) => w.id)).not.toContain("w2");
    });

    it("存在しない id は除外される", async () => {
      const repo = createPrismaWorkerRepository(prisma);
      await repo.create({ id: "w1", displayName: "A" });

      const result = await repo.listByIds(["w1", "not-exists"]);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("w1");
    });

    it("論理削除済みの worker は除外される", async () => {
      const repo = createPrismaWorkerRepository(prisma);
      await repo.create({ id: "w1", displayName: "A" });
      await repo.create({ id: "w2", displayName: "B" });
      await repo.softDelete("w2");

      const result = await repo.listByIds(["w1", "w2"]);

      expect(result.map((w) => w.id)).toEqual(["w1"]);
    });

    it("空配列を渡すと空配列を返す", async () => {
      const repo = createPrismaWorkerRepository(prisma);

      const result = await repo.listByIds([]);

      expect(result).toEqual([]);
    });
  });

  describe("resolveByAuthors", () => {
    it("author が id に一致するワーカーを返す", async () => {
      const repo = createPrismaWorkerRepository(prisma);
      await repo.create({ id: "uuid-haru", displayName: "haru" });

      const result = await repo.resolveByAuthors(["uuid-haru"]);

      expect(result.map((w) => w.id)).toEqual(["uuid-haru"]);
    });

    it("author が displayName に一致するワーカーを返す（旧データ互換）", async () => {
      const repo = createPrismaWorkerRepository(prisma);
      await repo.create({ id: "uuid-haru", displayName: "haru" });
      await repo.create({ id: "uuid-ken", displayName: "ken" });

      const result = await repo.resolveByAuthors(["haru", "ken"]);

      const displayNames = result.map((w) => w.displayName);
      expect(displayNames).toContain("haru");
      expect(displayNames).toContain("ken");
      expect(displayNames).toHaveLength(2);
    });

    it("入力 author の順序を保持する", async () => {
      const repo = createPrismaWorkerRepository(prisma);
      await repo.create({ id: "uuid-haru", displayName: "haru" });
      await repo.create({ id: "uuid-ken", displayName: "ken" });

      const result = await repo.resolveByAuthors(["ken", "haru"]);

      expect(result.map((w) => w.displayName)).toEqual(["ken", "haru"]);
    });

    it("解決できない author は除外される", async () => {
      const repo = createPrismaWorkerRepository(prisma);
      await repo.create({ id: "uuid-haru", displayName: "haru" });

      const result = await repo.resolveByAuthors(["haru", "unknown"]);

      expect(result.map((w) => w.displayName)).toEqual(["haru"]);
    });

    it("論理削除済みのワーカーは displayName 照合でも除外される", async () => {
      const repo = createPrismaWorkerRepository(prisma);
      await repo.create({ id: "uuid-haru", displayName: "haru" });
      await repo.softDelete("uuid-haru");

      const result = await repo.resolveByAuthors(["haru"]);

      expect(result).toEqual([]);
    });

    it("空配列を渡すと空配列を返す", async () => {
      const repo = createPrismaWorkerRepository(prisma);

      const result = await repo.resolveByAuthors([]);

      expect(result).toEqual([]);
    });
  });

  describe("listBotWorkers", () => {
    it("論理削除されていない worker を全件返す", async () => {
      const repo = createPrismaWorkerRepository(prisma);
      await repo.create({ id: "w1", displayName: "A" });
      await repo.create({ id: "w2", displayName: "B" });

      const result = await repo.listBotWorkers();

      expect(result).toHaveLength(2);
    });

    it("論理削除済みの worker は除外される", async () => {
      const repo = createPrismaWorkerRepository(prisma);
      await repo.create({ id: "w1", displayName: "A" });
      await repo.create({ id: "w2", displayName: "B" });
      await repo.softDelete("w2");

      const result = await repo.listBotWorkers();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("w1");
    });

    it("空の場合は空配列を返す", async () => {
      const repo = createPrismaWorkerRepository(prisma);

      const result = await repo.listBotWorkers();

      expect(result).toEqual([]);
    });
  });

  describe("listAllBotWorkers", () => {
    it("論理削除済みを含めて全件返す", async () => {
      const repo = createPrismaWorkerRepository(prisma);
      await repo.create({ id: "w1", displayName: "A" });
      await repo.create({ id: "w2", displayName: "B" });
      await repo.softDelete("w2");

      const result = await repo.listAllBotWorkers();

      expect(result).toHaveLength(2);
      const ids = result.map((w) => w.id);
      expect(ids).toContain("w1");
      expect(ids).toContain("w2");
    });
  });

  describe("softDelete", () => {
    it("deletedAt がセットされ、以後の findById・listBotWorkers から外れる", async () => {
      const repo = createPrismaWorkerRepository(prisma);
      await repo.create({ id: "w1", displayName: "A" });
      await repo.create({ id: "w2", displayName: "B" });

      const deleted = await repo.softDelete("w1");

      expect(deleted?.deletedAt).toBeInstanceOf(Date);
      expect(await repo.findById("w1")).toBeNull();
      const list = await repo.listBotWorkers();
      expect(list.map((w) => w.id)).toEqual(["w2"]);
    });

    it("存在しない id は null を返す", async () => {
      const repo = createPrismaWorkerRepository(prisma);

      const result = await repo.softDelete("not-exists");

      expect(result).toBeNull();
    });

    it("既に論理削除済みの worker への再削除は null を返す", async () => {
      const repo = createPrismaWorkerRepository(prisma);
      await repo.create({ id: "w1", displayName: "A" });
      await repo.softDelete("w1");

      const result = await repo.softDelete("w1");

      expect(result).toBeNull();
    });
  });

  describe("findDeletedById", () => {
    it("論理削除済みの worker を id で取得できる", async () => {
      const repo = createPrismaWorkerRepository(prisma);
      await repo.create({ id: "w1", displayName: "A" });
      await repo.softDelete("w1");

      const result = await repo.findDeletedById("w1");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("w1");
      expect(result?.deletedAt).toBeInstanceOf(Date);
    });

    it("論理削除されていない worker も取得できる", async () => {
      const repo = createPrismaWorkerRepository(prisma);
      await repo.create({ id: "w1", displayName: "A" });

      const result = await repo.findDeletedById("w1");

      expect(result).not.toBeNull();
      expect(result?.deletedAt).toBeNull();
    });

    it("存在しない id は null を返す", async () => {
      const repo = createPrismaWorkerRepository(prisma);

      const result = await repo.findDeletedById("not-exists");

      expect(result).toBeNull();
    });
  });

  describe("updateImageUrl", () => {
    it("imageUrl が反映される", async () => {
      const repo = createPrismaWorkerRepository(prisma);
      await repo.create({ id: "w1", displayName: "A" });

      const updated = await repo.updateImageUrl("w1", "https://example.com/a.png");

      expect(updated?.imageUrl).toBe("https://example.com/a.png");
      const found = await repo.findById("w1");
      expect(found?.imageUrl).toBe("https://example.com/a.png");
    });

    it("存在しない id は null を返す", async () => {
      const repo = createPrismaWorkerRepository(prisma);

      const result = await repo.updateImageUrl("not-exists", "https://example.com/a.png");

      expect(result).toBeNull();
    });

    it("論理削除済みの worker にも imageUrl を反映できる（現仕様）", async () => {
      const repo = createPrismaWorkerRepository(prisma);
      await repo.create({ id: "w1", displayName: "A" });
      await repo.softDelete("w1");

      const updated = await repo.updateImageUrl("w1", "https://example.com/a.png");

      expect(updated?.imageUrl).toBe("https://example.com/a.png");
    });
  });
});
