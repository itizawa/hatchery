import { describe, expect, it } from "vitest";

import type { WorkerState } from "./worldState.js";
import { selectRotatedWorkers } from "./selectRotatedWorkers.js";

interface TestWorker {
  id: string;
}

const haru: TestWorker = { id: "haru" };
const ken: TestWorker = { id: "ken" };
const mei: TestWorker = { id: "mei" };
const workers: TestWorker[] = [haru, ken, mei];

describe("selectRotatedWorkers (#464)", () => {
  it("全員が未登場（lastAppearedSlotKey undefined）のとき入力順で決定的に返す", () => {
    const states: Record<string, WorkerState> = {};
    const a = selectRotatedWorkers(workers, states, 2);
    const b = selectRotatedWorkers(workers, states, 2);
    expect(a).toEqual(b);
    // 全員未登場 = 同点 → 入力順で安定（haru, ken）
    expect(a).toEqual(["haru", "ken"]);
  });

  it("直近の slotKey で登場済みのワーカーは後回しになり未登場ワーカーが優先される", () => {
    // haru/mei は登場済み、ken のみ未登場 → ken が最優先
    const states: Record<string, WorkerState> = {
      haru: { lastAppearedSlotKey: "2026-06-13T12:00" },
      mei: { lastAppearedSlotKey: "2026-06-13T09:00" },
    };
    expect(selectRotatedWorkers(workers, states, 1)).toEqual(["ken"]);
  });

  it("全員登場済みなら lastAppearedSlotKey が古い（辞書順で前）ワーカーを優先する", () => {
    // ken=最古, mei=中間, haru=最新
    const states: Record<string, WorkerState> = {
      haru: { lastAppearedSlotKey: "2026-06-13T18:00" },
      ken: { lastAppearedSlotKey: "2026-06-13T09:00" },
      mei: { lastAppearedSlotKey: "2026-06-13T12:00" },
    };
    expect(selectRotatedWorkers(workers, states, 2)).toEqual(["ken", "mei"]);
  });

  it("未登場ワーカーは登場済みワーカー（どんなに古くても）より優先される", () => {
    // ken のみ未登場。haru/mei は古い slotKey でも登場済み → ken が先頭
    const states: Record<string, WorkerState> = {
      haru: { lastAppearedSlotKey: "2026-01-01T00:00" },
      mei: { lastAppearedSlotKey: "2026-01-01T00:00" },
    };
    const result = selectRotatedWorkers(workers, states, 3);
    expect(result[0]).toBe("ken");
    expect(result).toHaveLength(3);
  });

  it("選出人数が候補数を超える場合はローテーション順で全員返す", () => {
    const states: Record<string, WorkerState> = {
      haru: { lastAppearedSlotKey: "2026-06-13T18:00" },
      ken: { lastAppearedSlotKey: "2026-06-13T09:00" },
      mei: { lastAppearedSlotKey: "2026-06-13T12:00" },
    };
    // count=5 > 候補3 → 全員をローテーション順（古い順）で返す
    expect(selectRotatedWorkers(workers, states, 5)).toEqual(["ken", "mei", "haru"]);
  });

  it("候補が空のときは空配列を返す", () => {
    expect(selectRotatedWorkers([], {}, 3)).toEqual([]);
  });

  it("count <= 0 のときは空配列を返す", () => {
    expect(selectRotatedWorkers(workers, {}, 0)).toEqual([]);
    expect(selectRotatedWorkers(workers, {}, -1)).toEqual([]);
  });

  it("同じ lastAppearedSlotKey のワーカーは入力順で安定", () => {
    const states: Record<string, WorkerState> = {
      haru: { lastAppearedSlotKey: "2026-06-13T09:00" },
      ken: { lastAppearedSlotKey: "2026-06-13T09:00" },
      mei: { lastAppearedSlotKey: "2026-06-13T09:00" },
    };
    expect(selectRotatedWorkers(workers, states, 2)).toEqual(["haru", "ken"]);
  });

  it("入力（workers / workerStates）を破壊しない", () => {
    const workersInput = [...workers];
    const states: Record<string, WorkerState> = {
      haru: { lastAppearedSlotKey: "2026-06-13T18:00" },
      ken: { lastAppearedSlotKey: "2026-06-13T09:00" },
    };
    const statesCopy = JSON.parse(JSON.stringify(states)) as Record<string, WorkerState>;
    selectRotatedWorkers(workersInput, states, 2);
    expect(workersInput).toEqual(workers);
    expect(states).toEqual(statesCopy);
  });
});
