import { describe, expect, it } from "vitest";

import { WorkerStateSchema, WorldStateSchema } from "./worldState.js";

describe("WorkerStateSchema", () => {
  it("lastAppearedSlotKey を持つ（任意）", () => {
    const result = WorkerStateSchema.parse({
      lastAppearedSlotKey: "2026-06-10T09:00:00.000Z",
    });
    expect(result.lastAppearedSlotKey).toBe("2026-06-10T09:00:00.000Z");
  });

  it("空オブジェクトをパースできる（lastAppearedSlotKey は任意）", () => {
    const result = WorkerStateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("成長系フィールド（mood / experience / relations / hasEvolved）を持たない", () => {
    const result = WorkerStateSchema.parse({
      lastAppearedSlotKey: "2026-06-10T09:00:00.000Z",
    });
    expect("mood" in result).toBe(false);
    expect("experience" in result).toBe(false);
    expect("relations" in result).toBe(false);
    expect("hasEvolved" in result).toBe(false);
  });

  it("旧フィールドが残った JSON でもパースが落ちず strip される（マイグレーション不要）", () => {
    const legacy = {
      mood: "元気",
      experience: 10,
      lastAppearedSlotKey: "2026-06-10T09:00:00.000Z",
      relations: [{ targetWorkerId: "worker-ken", value: 5 }],
      hasEvolved: false,
    };
    const result = WorkerStateSchema.safeParse(legacy);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lastAppearedSlotKey).toBe("2026-06-10T09:00:00.000Z");
      expect("mood" in result.data).toBe(false);
      expect("experience" in result.data).toBe(false);
      expect("relations" in result.data).toBe(false);
      expect("hasEvolved" in result.data).toBe(false);
    }
  });
});

describe("WorldStateSchema", () => {
  const validWorldState = {
    summaryVersion: 1,
    workerStates: {
      "worker-haru": {
        lastAppearedSlotKey: "2026-06-10T09:00:00.000Z",
      },
    },
  };

  it("有効な world_state をパースできる", () => {
    const result = WorldStateSchema.safeParse(validWorldState);
    expect(result.success).toBe(true);
  });

  it("summaryVersion を持つ", () => {
    const result = WorldStateSchema.parse(validWorldState);
    expect(result.summaryVersion).toBe(1);
  });

  it("workerStates を持つ", () => {
    const result = WorldStateSchema.parse(validWorldState);
    expect(result.workerStates["worker-haru"]).toBeDefined();
  });

  it("workerState の lastAppearedSlotKey を持つ（任意）", () => {
    const result = WorldStateSchema.parse(validWorldState);
    expect(result.workerStates["worker-haru"]?.lastAppearedSlotKey).toBe(
      "2026-06-10T09:00:00.000Z",
    );
  });

  it("旧成長系フィールド入りの workerState でもパースが落ちず strip される", () => {
    const legacyWorldState = {
      summaryVersion: 1,
      workerStates: {
        "worker-haru": {
          mood: "元気",
          experience: 10,
          lastAppearedSlotKey: "2026-06-10T09:00:00.000Z",
          relations: [{ targetWorkerId: "worker-ken", value: 5 }],
          hasEvolved: false,
        },
      },
    };
    const result = WorldStateSchema.safeParse(legacyWorldState);
    expect(result.success).toBe(true);
    if (result.success) {
      const state = result.data.workerStates["worker-haru"];
      expect(state?.lastAppearedSlotKey).toBe("2026-06-10T09:00:00.000Z");
      expect("mood" in (state ?? {})).toBe(false);
    }
  });

  it("open_prompts を持たない（ADR-0020 でお題廃止）", () => {
    const result = WorldStateSchema.parse(validWorldState);
    expect("open_prompts" in result).toBe(false);
  });

  it("synopsis を持たない（Community 側に持つ）", () => {
    const result = WorldStateSchema.parse(validWorldState);
    expect("synopsis" in result).toBe(false);
  });

  it("空の workerStates で正常にパースできる", () => {
    const data = { summaryVersion: 0, workerStates: {} };
    const result = WorldStateSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("デフォルト値で空オブジェクトをパースできる", () => {
    const result = WorldStateSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.summaryVersion).toBe(0);
      expect(result.data.workerStates).toEqual({});
    }
  });
});
