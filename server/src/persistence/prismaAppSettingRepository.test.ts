import { describe, expect, it, vi } from "vitest";

import { PrismaAppSettingRepository } from "./prismaAppSettingRepository.js";

const now = new Date("2026-01-01T00:00:00Z");

function makePrismaMock() {
  return {
    appSetting: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  };
}

describe("PrismaAppSettingRepository", () => {
  describe("findAll", () => {
    it("全設定を AppSetting[] に変換して返す", async () => {
      const prismaMock = makePrismaMock();
      prismaMock.appSetting.findMany.mockResolvedValue([
        { key: "CLAUDE_API_KEY", value: "enc:value", updatedAt: now },
        { key: "SOME_SETTING", value: "other", updatedAt: now },
      ]);
      const repo = new PrismaAppSettingRepository(prismaMock as never);

      const result = await repo.findAll();

      expect(prismaMock.appSetting.findMany).toHaveBeenCalledOnce();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ key: "CLAUDE_API_KEY", value: "enc:value", updatedAt: now });
      expect(result[1]).toEqual({ key: "SOME_SETTING", value: "other", updatedAt: now });
    });

    it("設定が存在しない場合は空配列を返す", async () => {
      const prismaMock = makePrismaMock();
      prismaMock.appSetting.findMany.mockResolvedValue([]);
      const repo = new PrismaAppSettingRepository(prismaMock as never);

      const result = await repo.findAll();
      expect(result).toHaveLength(0);
    });
  });

  describe("findByKey", () => {
    it("key が存在する場合は AppSetting を返す", async () => {
      const prismaMock = makePrismaMock();
      prismaMock.appSetting.findUnique.mockResolvedValue({
        key: "CLAUDE_API_KEY",
        value: "enc:value",
        updatedAt: now,
      });
      const repo = new PrismaAppSettingRepository(prismaMock as never);

      const result = await repo.findByKey("CLAUDE_API_KEY");

      expect(prismaMock.appSetting.findUnique).toHaveBeenCalledWith({
        where: { key: "CLAUDE_API_KEY" },
      });
      expect(result).toEqual({ key: "CLAUDE_API_KEY", value: "enc:value", updatedAt: now });
    });

    it("key が存在しない場合は null を返す", async () => {
      const prismaMock = makePrismaMock();
      prismaMock.appSetting.findUnique.mockResolvedValue(null);
      const repo = new PrismaAppSettingRepository(prismaMock as never);

      const result = await repo.findByKey("NON_EXISTENT");
      expect(result).toBeNull();
    });
  });

  describe("upsert", () => {
    it("新規キーを作成する", async () => {
      const prismaMock = makePrismaMock();
      prismaMock.appSetting.upsert.mockResolvedValue({
        key: "NEW_KEY",
        value: "new_value",
        updatedAt: now,
      });
      const repo = new PrismaAppSettingRepository(prismaMock as never);

      const result = await repo.upsert("NEW_KEY", "new_value");

      expect(prismaMock.appSetting.upsert).toHaveBeenCalledWith({
        where: { key: "NEW_KEY" },
        update: { value: "new_value" },
        create: { key: "NEW_KEY", value: "new_value" },
      });
      expect(result).toEqual({ key: "NEW_KEY", value: "new_value", updatedAt: now });
    });

    it("既存キーを更新する", async () => {
      const prismaMock = makePrismaMock();
      prismaMock.appSetting.upsert.mockResolvedValue({
        key: "CLAUDE_API_KEY",
        value: "updated_enc",
        updatedAt: now,
      });
      const repo = new PrismaAppSettingRepository(prismaMock as never);

      const result = await repo.upsert("CLAUDE_API_KEY", "updated_enc");

      expect(result).toEqual({ key: "CLAUDE_API_KEY", value: "updated_enc", updatedAt: now });
    });
  });
});
