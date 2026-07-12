import { describe, expect, it } from "vitest";
import { createInMemoryWorkerRepository } from "./workerRepository.js";

const makeWorker = (
  overrides: Partial<Parameters<typeof createInMemoryWorkerRepository>[0][0]> = {},
) => ({
  id: "worker-1",
  displayName: "ワーカー1",
  role: "engineer",
  personality: "冷静沈着",
  ...overrides,
});

describe("createInMemoryWorkerRepository", () => {
  describe("create", () => {
    it("入力どおりの WorkerRecord を返す（imageUrl / deletedAt / verbosity は null）", async () => {
      const repo = createInMemoryWorkerRepository([]);
      const created = await repo.create({
        id: "worker-new",
        displayName: "新人ワーカー",
        role: "designer",
        personality: "好奇心旺盛",
      });
      expect(created).toEqual({
        id: "worker-new",
        displayName: "新人ワーカー",
        role: "designer",
        personality: "好奇心旺盛",
        verbosity: null,
        imageUrl: null,
        deletedAt: null,
      });
    });

    it("role / personality 省略時は null になる", async () => {
      const repo = createInMemoryWorkerRepository([]);
      const created = await repo.create({ id: "worker-min", displayName: "最小ワーカー" });
      expect(created.role).toBeNull();
      expect(created.personality).toBeNull();
    });

    it("作成した worker を findById で取得できる", async () => {
      const repo = createInMemoryWorkerRepository([]);
      await repo.create({ id: "worker-new", displayName: "新人ワーカー" });
      const found = await repo.findById("worker-new");
      expect(found).toMatchObject({ id: "worker-new", displayName: "新人ワーカー" });
    });
  });

  describe("findById", () => {
    it("存在する id で取得できる", async () => {
      const repo = createInMemoryWorkerRepository([makeWorker()]);
      const result = await repo.findById("worker-1");
      expect(result).toMatchObject({ id: "worker-1", displayName: "ワーカー1" });
    });

    it("存在しない id は null を返す", async () => {
      const repo = createInMemoryWorkerRepository([]);
      const result = await repo.findById("not-exists");
      expect(result).toBeNull();
    });

    it("論理削除済みの worker は null を返す", async () => {
      const repo = createInMemoryWorkerRepository([
        makeWorker({ deletedAt: new Date("2026-01-01") }),
      ]);
      const result = await repo.findById("worker-1");
      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("displayName / role / personality が反映される", async () => {
      const repo = createInMemoryWorkerRepository([makeWorker()]);
      const updated = await repo.update("worker-1", {
        displayName: "改名ワーカー",
        role: "manager",
        personality: "情熱的",
      });
      expect(updated).toMatchObject({
        id: "worker-1",
        displayName: "改名ワーカー",
        role: "manager",
        personality: "情熱的",
      });
      const found = await repo.findById("worker-1");
      expect(found).toMatchObject({ displayName: "改名ワーカー", role: "manager" });
    });

    it("未指定のフィールドは変更されない", async () => {
      const repo = createInMemoryWorkerRepository([makeWorker()]);
      const updated = await repo.update("worker-1", { displayName: "改名のみ" });
      expect(updated).toMatchObject({
        displayName: "改名のみ",
        role: "engineer",
        personality: "冷静沈着",
      });
    });

    it("存在しない id は null を返す", async () => {
      const repo = createInMemoryWorkerRepository([]);
      const result = await repo.update("not-exists", { displayName: "誰でもない" });
      expect(result).toBeNull();
    });

    it("論理削除済みの worker は更新できず null を返す", async () => {
      const repo = createInMemoryWorkerRepository([
        makeWorker({ deletedAt: new Date("2026-01-01") }),
      ]);
      const result = await repo.update("worker-1", { displayName: "復活させない" });
      expect(result).toBeNull();
    });
  });

  describe("listByIds", () => {
    it("指定した id の worker を ids の順序で返す", async () => {
      const repo = createInMemoryWorkerRepository([
        makeWorker({ id: "w1", displayName: "A" }),
        makeWorker({ id: "w2", displayName: "B" }),
        makeWorker({ id: "w3", displayName: "C" }),
      ]);
      const result = await repo.listByIds(["w3", "w1"]);
      expect(result.map((w) => w.id)).toEqual(["w3", "w1"]);
    });

    it("存在しない id は結果から除外される", async () => {
      const repo = createInMemoryWorkerRepository([makeWorker({ id: "w1" })]);
      const result = await repo.listByIds(["w1", "not-exists"]);
      expect(result.map((w) => w.id)).toEqual(["w1"]);
    });

    it("論理削除済みの worker は除外される", async () => {
      const repo = createInMemoryWorkerRepository([
        makeWorker({ id: "w1" }),
        makeWorker({ id: "w2", deletedAt: new Date("2026-01-01") }),
      ]);
      const result = await repo.listByIds(["w1", "w2"]);
      expect(result.map((w) => w.id)).toEqual(["w1"]);
    });
  });

  describe("listBotWorkers", () => {
    it("論理削除されていない worker を全件返す", async () => {
      const repo = createInMemoryWorkerRepository([
        makeWorker({ id: "w1" }),
        makeWorker({ id: "w2" }),
      ]);
      const result = await repo.listBotWorkers();
      expect(result.map((w) => w.id)).toEqual(["w1", "w2"]);
    });

    it("論理削除済みの worker は既定で除外される", async () => {
      const repo = createInMemoryWorkerRepository([
        makeWorker({ id: "w1" }),
        makeWorker({ id: "w2", deletedAt: new Date("2026-01-01") }),
      ]);
      const result = await repo.listBotWorkers();
      expect(result.map((w) => w.id)).toEqual(["w1"]);
    });

    it("空の場合は空配列を返す", async () => {
      const repo = createInMemoryWorkerRepository([]);
      expect(await repo.listBotWorkers()).toEqual([]);
    });
  });

  describe("listAllBotWorkers", () => {
    it("論理削除済みを含めて全件返す", async () => {
      const repo = createInMemoryWorkerRepository([
        makeWorker({ id: "w1" }),
        makeWorker({ id: "w2", deletedAt: new Date("2026-01-01") }),
      ]);
      const result = await repo.listAllBotWorkers();
      expect(result.map((w) => w.id)).toEqual(["w1", "w2"]);
    });
  });

  describe("softDelete", () => {
    it("deletedAt がセットされ、以後の既定一覧・findById から外れる", async () => {
      const repo = createInMemoryWorkerRepository([
        makeWorker({ id: "w1" }),
        makeWorker({ id: "w2" }),
      ]);
      const deleted = await repo.softDelete("w1");
      expect(deleted?.deletedAt).toBeInstanceOf(Date);
      expect(await repo.findById("w1")).toBeNull();
      const list = await repo.listBotWorkers();
      expect(list.map((w) => w.id)).toEqual(["w2"]);
    });

    it("存在しない id は null を返す", async () => {
      const repo = createInMemoryWorkerRepository([]);
      expect(await repo.softDelete("not-exists")).toBeNull();
    });

    it("既に論理削除済みの worker への再削除は null を返す", async () => {
      const repo = createInMemoryWorkerRepository([
        makeWorker({ deletedAt: new Date("2026-01-01") }),
      ]);
      expect(await repo.softDelete("worker-1")).toBeNull();
    });
  });

  describe("findDeletedById", () => {
    it("論理削除済みの worker も id で取得できる", async () => {
      const deletedAt = new Date("2026-01-01");
      const repo = createInMemoryWorkerRepository([makeWorker({ deletedAt })]);
      const result = await repo.findDeletedById("worker-1");
      expect(result).toMatchObject({ id: "worker-1", deletedAt });
    });

    it("論理削除されていない worker も取得できる", async () => {
      const repo = createInMemoryWorkerRepository([makeWorker()]);
      const result = await repo.findDeletedById("worker-1");
      expect(result).toMatchObject({ id: "worker-1", deletedAt: null });
    });

    it("存在しない id は null を返す", async () => {
      const repo = createInMemoryWorkerRepository([]);
      expect(await repo.findDeletedById("not-exists")).toBeNull();
    });
  });

  describe("updateImageUrl", () => {
    it("imageUrl が反映される", async () => {
      const repo = createInMemoryWorkerRepository([makeWorker()]);
      const updated = await repo.updateImageUrl("worker-1", "https://example.com/a.png");
      expect(updated?.imageUrl).toBe("https://example.com/a.png");
      const found = await repo.findById("worker-1");
      expect(found?.imageUrl).toBe("https://example.com/a.png");
    });

    it("存在しない id は null を返す", async () => {
      const repo = createInMemoryWorkerRepository([]);
      expect(await repo.updateImageUrl("not-exists", "https://example.com/a.png")).toBeNull();
    });

    it("論理削除済みの worker にも反映される（現仕様）", async () => {
      const repo = createInMemoryWorkerRepository([
        makeWorker({ deletedAt: new Date("2026-01-01") }),
      ]);
      const updated = await repo.updateImageUrl("worker-1", "https://example.com/a.png");
      expect(updated?.imageUrl).toBe("https://example.com/a.png");
    });
  });

  describe("clearImageUrl (#1057)", () => {
    it("imageUrl が null になる", async () => {
      const repo = createInMemoryWorkerRepository([
        makeWorker({ imageUrl: "https://source.boringavatars.com/beam/40/worker-1" }),
      ]);
      const updated = await repo.clearImageUrl("worker-1");
      expect(updated?.imageUrl).toBeNull();
      const found = await repo.findById("worker-1");
      expect(found?.imageUrl).toBeNull();
    });

    it("存在しない id は null を返す", async () => {
      const repo = createInMemoryWorkerRepository([]);
      expect(await repo.clearImageUrl("not-exists")).toBeNull();
    });

    it("論理削除済みの worker にも反映される（updateImageUrl と同じ現仕様）", async () => {
      const repo = createInMemoryWorkerRepository([
        makeWorker({
          imageUrl: "https://source.boringavatars.com/beam/40/worker-1",
          deletedAt: new Date("2026-01-01"),
        }),
      ]);
      const updated = await repo.clearImageUrl("worker-1");
      expect(updated?.imageUrl).toBeNull();
    });
  });

  describe("防御的コピー", () => {
    it("返却されたレコードを書き換えても内部状態に影響しない", async () => {
      const repo = createInMemoryWorkerRepository([makeWorker()]);
      const found = await repo.findById("worker-1");
      if (!found) throw new Error("worker-1 が見つからない");
      found.displayName = "外部から書き換え";
      const foundAgain = await repo.findById("worker-1");
      expect(foundAgain?.displayName).toBe("ワーカー1");
    });
  });

  describe("verbosity フィールド (#625)", () => {
    it("verbosity を指定して作成すると findById で取得できる（round-trip）", async () => {
      const repo = createInMemoryWorkerRepository([]);
      await repo.create({ id: "w-concise", displayName: "簡潔ワーカー", verbosity: "concise" });
      const found = await repo.findById("w-concise");
      expect(found?.verbosity).toBe("concise");
    });

    it("verbosity を省略して作成すると null になる", async () => {
      const repo = createInMemoryWorkerRepository([]);
      await repo.create({ id: "w-default", displayName: "デフォルトワーカー" });
      const found = await repo.findById("w-default");
      expect(found?.verbosity).toBeNull();
    });

    it("update で verbosity を変更できる", async () => {
      const repo = createInMemoryWorkerRepository([makeWorker()]);
      const updated = await repo.update("worker-1", { verbosity: "detailed" });
      expect(updated?.verbosity).toBe("detailed");
      const found = await repo.findById("worker-1");
      expect(found?.verbosity).toBe("detailed");
    });

    it("update で verbosity を省略すると変更されない", async () => {
      const repo = createInMemoryWorkerRepository([makeWorker({ verbosity: "concise" })]);
      const updated = await repo.update("worker-1", { displayName: "改名のみ" });
      expect(updated?.verbosity).toBe("concise");
    });
  });

  describe("count（#1113）", () => {
    it("worker が 0 件のとき 0 を返す", async () => {
      const repo = createInMemoryWorkerRepository([]);
      expect(await repo.count()).toBe(0);
    });

    it("worker が複数件のとき件数を返す", async () => {
      const repo = createInMemoryWorkerRepository([
        makeWorker({ id: "worker-1" }),
        makeWorker({ id: "worker-2" }),
      ]);
      expect(await repo.count()).toBe(2);
    });

    it("論理削除済み worker は件数に含めない（listBotWorkersPaginated の includeDeleted=false と同じ除外条件）", async () => {
      const repo = createInMemoryWorkerRepository([
        makeWorker({ id: "worker-1" }),
        makeWorker({ id: "worker-2", deletedAt: new Date("2026-01-01") }),
      ]);
      expect(await repo.count()).toBe(1);
    });
  });
});
