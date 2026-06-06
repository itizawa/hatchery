import { describe, expect, it } from "vitest";

import { InMemoryBatchRunLogRepository } from "./batchRunLogRepository.js";

describe("InMemoryBatchRunLogRepository", () => {
  describe("create", () => {
    it("成功ログを保存して返す", async () => {
      const repo = new InMemoryBatchRunLogRepository();
      const record = await repo.create({ status: "success", messageCount: 3 });
      expect(record.id).toBeTruthy();
      expect(record.status).toBe("success");
      expect(record.messageCount).toBe(3);
      expect(record.errorMessage).toBeNull();
      expect(record.errorCode).toBeNull();
      expect(record.executedAt).toBeInstanceOf(Date);
    });

    it("失敗ログを保存して返す", async () => {
      const repo = new InMemoryBatchRunLogRepository();
      const record = await repo.create({
        status: "failure",
        errorMessage: "API error",
        errorCode: "ERR_API",
      });
      expect(record.status).toBe("failure");
      expect(record.messageCount).toBeNull();
      expect(record.errorMessage).toBe("API error");
      expect(record.errorCode).toBe("ERR_API");
    });
  });

  describe("listRecent", () => {
    it("最新の N 件を executedAt 降順で返す", async () => {
      const repo = new InMemoryBatchRunLogRepository();
      await repo.create({ status: "success", messageCount: 1 });
      await repo.create({ status: "failure", errorMessage: "err" });
      await repo.create({ status: "success", messageCount: 2 });

      const records = await repo.listRecent(10);
      expect(records).toHaveLength(3);
      expect(records[0]!.messageCount).toBe(2);
      expect(records[2]!.messageCount).toBe(1);
    });

    it("limit を超えるレコードがある場合は最新の limit 件のみ返す", async () => {
      const repo = new InMemoryBatchRunLogRepository();
      for (let i = 0; i < 5; i++) {
        await repo.create({ status: "success", messageCount: i });
      }

      const records = await repo.listRecent(3);
      expect(records).toHaveLength(3);
      expect(records[0]!.messageCount).toBe(4);
    });

    it("レコードが空の場合は空配列を返す", async () => {
      const repo = new InMemoryBatchRunLogRepository();
      const records = await repo.listRecent(50);
      expect(records).toHaveLength(0);
    });
  });
});
