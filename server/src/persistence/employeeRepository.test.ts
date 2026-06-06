import { describe, expect, it } from "vitest";

import { InMemoryEmployeeRepository } from "./employeeRepository.js";

describe("InMemoryEmployeeRepository (#38)", () => {
  const seed = [
    { id: "haru", displayName: "haru", role: "ムードメーカー", isBot: true, personality: null },
    { id: "ken", displayName: "ken", role: "ベテラン", isBot: true, personality: null },
  ];

  describe("findById", () => {
    it("存在する Employee を返す", async () => {
      const repo = new InMemoryEmployeeRepository(seed);
      const e = await repo.findById("haru");
      expect(e?.id).toBe("haru");
      expect(e?.displayName).toBe("haru");
    });

    it("存在しない id なら null を返す", async () => {
      const repo = new InMemoryEmployeeRepository(seed);
      const e = await repo.findById("unknown");
      expect(e).toBeNull();
    });
  });

  describe("update", () => {
    it("フィールドを更新して更新後の Employee を返す", async () => {
      const repo = new InMemoryEmployeeRepository(seed);
      const updated = await repo.update("haru", { personality: "明るく前向き" });
      expect(updated?.personality).toBe("明るく前向き");
      expect(updated?.displayName).toBe("haru");
    });

    it("displayName を更新できる", async () => {
      const repo = new InMemoryEmployeeRepository(seed);
      const updated = await repo.update("haru", { displayName: "ハル" });
      expect(updated?.displayName).toBe("ハル");
    });

    it("存在しない id なら null を返す", async () => {
      const repo = new InMemoryEmployeeRepository(seed);
      const updated = await repo.update("unknown", { personality: "test" });
      expect(updated).toBeNull();
    });

    it("findById でも更新が反映される（ミュータブル）", async () => {
      const repo = new InMemoryEmployeeRepository(seed);
      await repo.update("ken", { personality: "慎重派" });
      const e = await repo.findById("ken");
      expect(e?.personality).toBe("慎重派");
    });
  });

  describe("listByIds (#53)", () => {
    it("指定 id の Employee を入力順で返す", async () => {
      const repo = new InMemoryEmployeeRepository(seed);
      const list = await repo.listByIds(["ken", "haru"]);
      expect(list.map((e) => e.id)).toEqual(["ken", "haru"]);
    });

    it("存在しない id は除外する", async () => {
      const repo = new InMemoryEmployeeRepository(seed);
      const list = await repo.listByIds(["haru", "unknown"]);
      expect(list.map((e) => e.id)).toEqual(["haru"]);
    });

    it("空配列なら空配列を返す", async () => {
      const repo = new InMemoryEmployeeRepository(seed);
      expect(await repo.listByIds([])).toEqual([]);
    });
  });
});
