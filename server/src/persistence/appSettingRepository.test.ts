import type { AppSetting } from "@hatchery/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInMemoryAppSettingRepository } from "./appSettingRepository.js";

const makeSetting = (overrides: Partial<AppSetting> = {}): AppSetting => ({
  key: "CLAUDE_API_KEY",
  value: "enc:value",
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  ...overrides,
});

describe("createInMemoryAppSettingRepository", () => {
  describe("findAll", () => {
    it("初期設定が無い場合は空配列を返す", async () => {
      const repo = createInMemoryAppSettingRepository();
      expect(await repo.findAll()).toEqual([]);
    });

    it("初期設定を複数件返す", async () => {
      const repo = createInMemoryAppSettingRepository([
        makeSetting({ key: "A", value: "a" }),
        makeSetting({ key: "B", value: "b" }),
      ]);
      const result = await repo.findAll();
      expect(result.map((s) => s.key)).toEqual(["A", "B"]);
      expect(result.map((s) => s.value)).toEqual(["a", "b"]);
    });

    it("返却値は内部状態のコピーで、書き換えても次回取得に影響しない", async () => {
      const repo = createInMemoryAppSettingRepository([makeSetting({ key: "A", value: "a" })]);
      const first = await repo.findAll();
      first[0]!.value = "外部から書き換え";
      const again = await repo.findAll();
      expect(again[0]!.value).toBe("a");
    });

    it("コンストラクタに渡した配列の要素を書き換えても内部状態に影響しない", async () => {
      const initial = [makeSetting({ key: "A", value: "a" })];
      const repo = createInMemoryAppSettingRepository(initial);
      initial[0]!.value = "外部から書き換え";
      const result = await repo.findAll();
      expect(result[0]!.value).toBe("a");
    });
  });

  describe("findByKey", () => {
    it("存在する key で AppSetting を返す", async () => {
      const repo = createInMemoryAppSettingRepository([makeSetting({ key: "A", value: "a" })]);
      const result = await repo.findByKey("A");
      expect(result).toMatchObject({ key: "A", value: "a" });
    });

    it("存在しない key は null を返す", async () => {
      const repo = createInMemoryAppSettingRepository([makeSetting({ key: "A" })]);
      expect(await repo.findByKey("not-exists")).toBeNull();
    });

    it("初期設定の配列要素を書き換えても findByKey の結果に影響しない（コンストラクタの防御的コピー）", async () => {
      const initial = [makeSetting({ key: "A", value: "a" })];
      const repo = createInMemoryAppSettingRepository(initial);
      initial[0]!.value = "外部から書き換え";
      const result = await repo.findByKey("A");
      expect(result!.value).toBe("a");
    });
  });

  describe("upsert", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-06-01T00:00:00Z"));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("新規 key を作成して返し、以後 findByKey で取得できる", async () => {
      const repo = createInMemoryAppSettingRepository();
      const created = await repo.upsert("NEW_KEY", "new-value");
      expect(created).toMatchObject({ key: "NEW_KEY", value: "new-value" });
      expect(created.updatedAt).toBeInstanceOf(Date);

      const found = await repo.findByKey("NEW_KEY");
      expect(found).toMatchObject({ key: "NEW_KEY", value: "new-value" });

      const all = await repo.findAll();
      expect(all).toHaveLength(1);
    });

    it("既存 key を更新し value と updatedAt が変わる（件数は増えない）", async () => {
      const beforeUpdatedAt = new Date("2026-01-01T00:00:00Z");
      const repo = createInMemoryAppSettingRepository([
        makeSetting({ key: "A", value: "old", updatedAt: beforeUpdatedAt }),
      ]);

      vi.setSystemTime(new Date("2026-06-02T00:00:00Z"));
      const updated = await repo.upsert("A", "new");

      expect(updated).toMatchObject({ key: "A", value: "new" });
      expect(updated.updatedAt.getTime()).toBeGreaterThan(beforeUpdatedAt.getTime());

      const all = await repo.findAll();
      expect(all).toHaveLength(1);
      expect(all[0]!.value).toBe("new");
    });

    it("戻り値は内部状態のコピーで、書き換えても内部に影響しない", async () => {
      const repo = createInMemoryAppSettingRepository();
      const created = await repo.upsert("A", "a");
      created.value = "外部から書き換え";
      const found = await repo.findByKey("A");
      expect(found!.value).toBe("a");
    });
  });
});
