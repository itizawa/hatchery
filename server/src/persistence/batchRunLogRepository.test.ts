import { describe, expect, it } from "vitest";
import { createInMemoryBatchRunLogRepository } from "./batchRunLogRepository.js";

describe("createInMemoryBatchRunLogRepository", () => {
  it("create は id と executedAt を付与して success ログを保存する", async () => {
    const repo = createInMemoryBatchRunLogRepository();
    const log = await repo.create({
      status: "success",
      messageCount: 5,
      errorMessage: null,
      errorCode: null,
    });
    expect(log.id).toBeDefined();
    expect(log.executedAt).toBeInstanceOf(Date);
    expect(log.status).toBe("success");
    expect(log.messageCount).toBe(5);
    expect(log.errorMessage).toBeNull();
    expect(log.errorCode).toBeNull();
  });

  it("create は failure ログ（errorMessage / errorCode あり）を保存できる", async () => {
    const repo = createInMemoryBatchRunLogRepository();
    const log = await repo.create({
      status: "failure",
      messageCount: 0,
      errorMessage: "generation failed",
      errorCode: "GENERATION_ERROR",
    });
    expect(log.status).toBe("failure");
    expect(log.errorMessage).toBe("generation failed");
    expect(log.errorCode).toBe("GENERATION_ERROR");
  });

  it("create は呼び出しごとに異なる id を付与する", async () => {
    const repo = createInMemoryBatchRunLogRepository();
    const log1 = await repo.create({
      status: "success",
      messageCount: 1,
      errorMessage: null,
      errorCode: null,
    });
    const log2 = await repo.create({
      status: "success",
      messageCount: 2,
      errorMessage: null,
      errorCode: null,
    });
    expect(log1.id).not.toBe(log2.id);
  });

  it("findRecent はログ未登録時に空配列を返す", async () => {
    const repo = createInMemoryBatchRunLogRepository();
    expect(await repo.findRecent(10)).toEqual([]);
  });

  it("findRecent は executedAt 降順（同一時刻は挿入の新しい順）で最大 limit 件返す", async () => {
    const repo = createInMemoryBatchRunLogRepository();
    await repo.create({ status: "success", messageCount: 1, errorMessage: null, errorCode: null });
    await repo.create({ status: "success", messageCount: 2, errorMessage: null, errorCode: null });
    await repo.create({ status: "success", messageCount: 3, errorMessage: null, errorCode: null });

    const logs = await repo.findRecent(2);
    expect(logs).toHaveLength(2);
    expect(logs[0].messageCount).toBe(3);
    expect(logs[1].messageCount).toBe(2);
  });

  it("findRecent は登録件数より大きい limit でも全件を返す", async () => {
    const repo = createInMemoryBatchRunLogRepository();
    await repo.create({ status: "success", messageCount: 1, errorMessage: null, errorCode: null });
    const logs = await repo.findRecent(10);
    expect(logs).toHaveLength(1);
  });
});
