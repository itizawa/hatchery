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
    it("入力どおりの WorkerRecord を返す（imageUrl / deletedAt は null）", async () => {
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

  describe("resolveByAuthors", () => {
    it("author が id（UUID 等）に一致するワーカーを返す", async () => {
      const repo = createInMemoryWorkerRepository([
        makeWorker({ id: "c9226003-uuid", displayName: "haru" }),
      ]);
      const result = await repo.resolveByAuthors(["c9226003-uuid"]);
      expect(result.map((w) => w.id)).toEqual(["c9226003-uuid"]);
    });

    it("author が displayName に一致するワーカーを返す（旧データ互換）", async () => {
      const repo = createInMemoryWorkerRepository([
        makeWorker({ id: "c9226003-uuid", displayName: "haru" }),
        makeWorker({ id: "d89954ec-uuid", displayName: "ken" }),
        makeWorker({ id: "e0000000-uuid", displayName: "mei" }),
      ]);
      const result = await repo.resolveByAuthors(["haru", "ken", "mei"]);
      expect(result.map((w) => w.displayName)).toEqual(["haru", "ken", "mei"]);
    });

    it("入力 author の順序を保持する", async () => {
      const repo = createInMemoryWorkerRepository([
        makeWorker({ id: "u1", displayName: "haru" }),
        makeWorker({ id: "u2", displayName: "ken" }),
      ]);
      const result = await repo.resolveByAuthors(["ken", "haru"]);
      expect(result.map((w) => w.displayName)).toEqual(["ken", "haru"]);
    });

    it("解決できない author は結果から除外される", async () => {
      const repo = createInMemoryWorkerRepository([makeWorker({ id: "u1", displayName: "haru" })]);
      const result = await repo.resolveByAuthors(["haru", "unknown"]);
      expect(result.map((w) => w.displayName)).toEqual(["haru"]);
    });

    it("論理削除済みのワーカーは displayName 照合でも除外される", async () => {
      const repo = createInMemoryWorkerRepository([
        makeWorker({ id: "u1", displayName: "haru", deletedAt: new Date("2026-01-01") }),
      ]);
      const result = await repo.resolveByAuthors(["haru"]);
      expect(result).toEqual([]);
    });

    it("id 一致を displayName 一致より優先する", async () => {
      // 「haru」という文字列が、あるワーカーの id でもあり別ワーカーの displayName でもある場合。
      const repo = createInMemoryWorkerRepository([
        makeWorker({ id: "other", displayName: "haru" }),
        makeWorker({ id: "haru", displayName: "本物" }),
      ]);
      const result = await repo.resolveByAuthors(["haru"]);
      expect(result.map((w) => w.id)).toEqual(["haru"]);
    });

    it("空配列を渡すと空配列を返す", async () => {
      const repo = createInMemoryWorkerRepository([makeWorker()]);
      expect(await repo.resolveByAuthors([])).toEqual([]);
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
});
