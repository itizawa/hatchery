import { describe, expect, it } from "vitest";

import type { Employee } from "../domain/employee/index.js";
import { MessageSchema } from "../domain/message/index.js";

import { buildRosterMessages, selectRandomMembers } from "./buildRosterMessages.js";

/** テスト用の決定的 rng（与えた値を循環して返す）。 */
const seq = (values: number[]): (() => number) => {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
};

const EMPLOYEES: Employee[] = [
  { id: "a", displayName: "A" },
  { id: "b", displayName: "B" },
  { id: "c", displayName: "C" },
];

const TEMPLATES = {
  a: ["a1", "a2"],
  b: ["b1", "b2"],
  c: ["c1"],
};

describe("selectRandomMembers — 複数社員をランダム選定（#32）", () => {
  it("count 名を重複なく選ぶ", () => {
    const picked = selectRandomMembers(EMPLOYEES, 2, seq([0.1, 0.9, 0.4]));
    expect(picked).toHaveLength(2);
    expect(new Set(picked).size).toBe(2);
    for (const id of picked) {
      expect(EMPLOYEES.map((e) => e.id)).toContain(id);
    }
  });

  it("count が候補数以上なら全員を返す（集合として）", () => {
    const picked = selectRandomMembers(EMPLOYEES, 5, seq([0.3]));
    expect(new Set(picked)).toEqual(new Set(["a", "b", "c"]));
  });

  it("count <= 0 なら空配列", () => {
    expect(selectRandomMembers(EMPLOYEES, 0, seq([0.3]))).toEqual([]);
    expect(selectRandomMembers(EMPLOYEES, -1, seq([0.3]))).toEqual([]);
  });

  it("同じ rng 列に対し決定的", () => {
    const r1 = selectRandomMembers(EMPLOYEES, 2, seq([0.2, 0.7, 0.5]));
    const r2 = selectRandomMembers(EMPLOYEES, 2, seq([0.2, 0.7, 0.5]));
    expect(r1).toEqual(r2);
  });

  it("入力配列を破壊しない", () => {
    const input = [...EMPLOYEES];
    selectRandomMembers(input, 2, seq([0.9, 0.1]));
    expect(input.map((e) => e.id)).toEqual(["a", "b", "c"]);
  });
});

describe("buildRosterMessages — 定時の発言を組み立てる（#32）", () => {
  it("各チャンネルに perChannel 名分の発言を生成する", () => {
    const messages = buildRosterMessages({
      channels: ["zatsudan", "shigoto"],
      employees: EMPLOYEES,
      templates: TEMPLATES,
      perChannel: 2,
      rng: seq([0.1, 0.4, 0.6, 0.2, 0.8, 0.5]),
    });
    expect(messages).toHaveLength(4);
  });

  it("生成した全メッセージは MessageSchema を満たす", () => {
    const messages = buildRosterMessages({
      channels: ["zatsudan"],
      employees: EMPLOYEES,
      templates: TEMPLATES,
      perChannel: 2,
      rng: seq([0.1, 0.4, 0.6, 0.2]),
    });
    for (const m of messages) {
      expect(MessageSchema.safeParse(m).success).toBe(true);
    }
  });

  it("speaker は候補社員、channel は入力チャンネル、text は当該社員のテンプレート由来", () => {
    const messages = buildRosterMessages({
      channels: ["zatsudan"],
      employees: EMPLOYEES,
      templates: TEMPLATES,
      perChannel: 3,
      rng: seq([0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
    });
    for (const m of messages) {
      expect(["a", "b", "c"]).toContain(m.speaker);
      expect(m.channel).toBe("zatsudan");
      expect(TEMPLATES[m.speaker as "a" | "b" | "c"]).toContain(m.text);
    }
  });

  it("同じ rng 列に対し決定的", () => {
    const args = {
      channels: ["zatsudan", "shigoto"],
      employees: EMPLOYEES,
      templates: TEMPLATES,
      perChannel: 2,
    };
    const r1 = buildRosterMessages({ ...args, rng: seq([0.3, 0.6, 0.1, 0.9, 0.5, 0.2]) });
    const r2 = buildRosterMessages({ ...args, rng: seq([0.3, 0.6, 0.1, 0.9, 0.5, 0.2]) });
    expect(r1).toEqual(r2);
  });

  it("テンプレートが無い社員は発言をスキップする", () => {
    const messages = buildRosterMessages({
      channels: ["zatsudan"],
      employees: [{ id: "x", displayName: "X" }],
      templates: TEMPLATES,
      perChannel: 1,
      rng: seq([0.0]),
    });
    expect(messages).toHaveLength(0);
  });
});
