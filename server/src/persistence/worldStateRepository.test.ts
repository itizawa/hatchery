import { describe, expect, it } from "vitest";
import { createInMemoryWorldStateRepository } from "./worldStateRepository.js";

describe("createInMemoryWorldStateRepository", () => {
  it("get は未保存時に null を返す", async () => {
    const repo = createInMemoryWorldStateRepository();
    expect(await repo.get()).toBeNull();
  });

  it("upsert は id=singleton と updatedAt を付与して保存し get に反映される", async () => {
    const repo = createInMemoryWorldStateRepository();
    const saved = await repo.upsert({
      summaryVersion: 1,
      workerStates: { "worker-1": { lastAppearedSlotKey: "2026-06-11-morning" } },
    });
    expect(saved.id).toBe("singleton");
    expect(saved.updatedAt).toBeInstanceOf(Date);
    expect(saved.summaryVersion).toBe(1);
    expect(saved.workerStates).toEqual({
      "worker-1": { lastAppearedSlotKey: "2026-06-11-morning" },
    });

    const fetched = await repo.get();
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe("singleton");
    expect(fetched?.summaryVersion).toBe(1);
    expect(fetched?.workerStates).toEqual(saved.workerStates);
  });

  it("upsert を 2 回呼ぶと後の値で上書きされる（singleton は 1 件のみ）", async () => {
    const repo = createInMemoryWorldStateRepository();
    await repo.upsert({ summaryVersion: 1, workerStates: {} });
    await repo.upsert({
      summaryVersion: 2,
      workerStates: { "worker-2": { lastAppearedSlotKey: "slot-2" } },
    });

    const fetched = await repo.get();
    expect(fetched?.id).toBe("singleton");
    expect(fetched?.summaryVersion).toBe(2);
    expect(fetched?.workerStates).toEqual({ "worker-2": { lastAppearedSlotKey: "slot-2" } });
  });

  it("get の戻り値を変更しても内部状態に影響しない（防御的コピー）", async () => {
    const repo = createInMemoryWorldStateRepository();
    await repo.upsert({ summaryVersion: 1, workerStates: {} });

    const first = await repo.get();
    if (!first) throw new Error("record should exist");
    first.summaryVersion = 999;

    const second = await repo.get();
    expect(second?.summaryVersion).toBe(1);
  });
});
