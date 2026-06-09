import { describe, expect, it } from "vitest";

import { InMemoryEmployeeRepository } from "./employeeRepository.js";

describe("InMemoryEmployeeRepository (#38)", () => {
  const seed = [
    { id: "haru", displayName: "haru", role: "ムードメーカー", isBot: true, personality: null, imageUrl: null },
    { id: "ken", displayName: "ken", role: "ベテラン", isBot: true, personality: null, imageUrl: null },
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

  describe("create (#217)", () => {
    it("新しい Employee を作成して返す", async () => {
      const repo = new InMemoryEmployeeRepository([]);
      const created = await repo.create({ id: "new-id", displayName: "新社員", isBot: true });
      expect(created.id).toBe("new-id");
      expect(created.displayName).toBe("新社員");
      expect(created.isBot).toBe(true);
      expect(created.role).toBeNull();
      expect(created.personality).toBeNull();
    });

    it("role を指定して作成できる", async () => {
      const repo = new InMemoryEmployeeRepository([]);
      const created = await repo.create({ id: "new-id", displayName: "社員", role: "エンジニア", isBot: true });
      expect(created.role).toBe("エンジニア");
    });

    it("personality を指定して作成できる", async () => {
      const repo = new InMemoryEmployeeRepository([]);
      const created = await repo.create({ id: "new-id", displayName: "社員", personality: "明るい", isBot: true });
      expect(created.personality).toBe("明るい");
    });

    it("作成した Employee が findById で取得できる", async () => {
      const repo = new InMemoryEmployeeRepository([]);
      await repo.create({ id: "new-id", displayName: "新社員", isBot: true });
      const found = await repo.findById("new-id");
      expect(found?.id).toBe("new-id");
    });
  });

  describe("listBotEmployees (#240)", () => {
    it("isBot=true の Employee のみを返す", async () => {
      const repo = new InMemoryEmployeeRepository([
        { id: "bot1", displayName: "Bot", role: null, isBot: true, personality: null, imageUrl: null },
        { id: "user1", displayName: "User", role: null, isBot: false, personality: null, imageUrl: null },
      ]);
      const list = await repo.listBotEmployees();
      expect(list.map((e) => e.id)).toEqual(["bot1"]);
    });

    it("Bot でない Employee は含まれない", async () => {
      const repo = new InMemoryEmployeeRepository([
        { id: "user1", displayName: "User", role: null, isBot: false, personality: null, imageUrl: null },
      ]);
      const list = await repo.listBotEmployees();
      expect(list).toHaveLength(0);
    });

    it("Bot が存在しない場合は空配列を返す", async () => {
      const repo = new InMemoryEmployeeRepository([]);
      expect(await repo.listBotEmployees()).toEqual([]);
    });

    it("seed（全員 isBot=true）なら全員返す", async () => {
      const repo = new InMemoryEmployeeRepository(seed);
      const list = await repo.listBotEmployees();
      expect(list.map((e) => e.id)).toEqual(["haru", "ken"]);
    });
  });

  describe("listAllBotEmployees (#218)", () => {
    it("論理削除済みも含む isBot=true の Employee を全件返す", async () => {
      const repo = new InMemoryEmployeeRepository([
        { id: "bot1", displayName: "Bot", role: null, isBot: true, personality: null },
        { id: "bot2", displayName: "DeletedBot", role: null, isBot: true, personality: null, deletedAt: new Date() },
        { id: "user1", displayName: "User", role: null, isBot: false, personality: null },
      ]);
      const list = await repo.listAllBotEmployees();
      expect(list.map((e) => e.id).sort()).toEqual(["bot1", "bot2"]);
    });

    it("isBot=false は含まれない", async () => {
      const repo = new InMemoryEmployeeRepository([
        { id: "user1", displayName: "User", role: null, isBot: false, personality: null },
      ]);
      const list = await repo.listAllBotEmployees();
      expect(list).toHaveLength(0);
    });
  });

  describe("softDelete (#218)", () => {
    it("存在する Employee を論理削除すると deletedAt が設定される", async () => {
      const repo = new InMemoryEmployeeRepository(seed);
      const result = await repo.softDelete("haru");
      expect(result).not.toBeNull();
      expect(result?.deletedAt).toBeInstanceOf(Date);
    });

    it("存在しない id なら null を返す", async () => {
      const repo = new InMemoryEmployeeRepository(seed);
      const result = await repo.softDelete("unknown");
      expect(result).toBeNull();
    });

    it("論理削除済み Employee は listBotEmployees に含まれない", async () => {
      const repo = new InMemoryEmployeeRepository(seed);
      await repo.softDelete("haru");
      const list = await repo.listBotEmployees();
      expect(list.map((e) => e.id)).toEqual(["ken"]);
    });

    it("論理削除済み Employee は findById で null を返す", async () => {
      const repo = new InMemoryEmployeeRepository(seed);
      await repo.softDelete("haru");
      const found = await repo.findById("haru");
      expect(found).toBeNull();
    });
  });
});
