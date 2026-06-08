import { CHANNEL_IDS, DEFAULT_EMPLOYEES, MessageSchema } from "@hatchery/common";
import { describe, expect, it } from "vitest";

import { InMemoryMessageRepository } from "../persistence/messageRepository.js";

import { runMessageBatch } from "./runMessageBatch.js";
import { createRosterMessageGenerator } from "./rosterMessageGenerator.js";

/** 決定的 rng。 */
const seq = (values: number[]): (() => number) => {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
};

describe("createRosterMessageGenerator — 既定の社員・チャンネル・テンプレートで発言生成（#32）", () => {
  it("既定では DEFAULT_CHANNELS の channel と DEFAULT_EMPLOYEES の speaker のみを含む", () => {
    const generate = createRosterMessageGenerator({ rng: seq([0.1, 0.4, 0.6, 0.2]) });
    const messages = generate();
    expect(messages.length).toBeGreaterThan(0);
    const employeeIds = DEFAULT_EMPLOYEES.map((e) => e.id);
    for (const m of messages) {
      expect(MessageSchema.safeParse(m).success).toBe(true);
      expect(CHANNEL_IDS as readonly string[]).toContain(m.channel);
      expect(employeeIds).toContain(m.createdEmployeeId);
    }
  });

  it("同じ rng 列に対し決定的", () => {
    const g1 = createRosterMessageGenerator({ rng: seq([0.2, 0.7, 0.5, 0.9]) });
    const g2 = createRosterMessageGenerator({ rng: seq([0.2, 0.7, 0.5, 0.9]) });
    expect(g1()).toEqual(g2());
  });

  it("runMessageBatch に注入してメッセージを永続化できる", async () => {
    const repo = new InMemoryMessageRepository();
    const generate = createRosterMessageGenerator({ rng: seq([0.1, 0.4, 0.6, 0.2]) });
    const records = await runMessageBatch({ messageRepository: repo, generate });
    expect(records.length).toBeGreaterThan(0);
    expect(await repo.list()).toHaveLength(records.length);
  });
});
