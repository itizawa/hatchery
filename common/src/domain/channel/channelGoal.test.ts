import { describe, expect, it } from "vitest";

import {
  CHANNEL_GOAL_INSTRUCTIONS_MAX_LENGTH,
  ChannelGoalSchema,
  ChannelGoalTypeSchema,
  ChannelSchema,
  CreateChannelSchema,
  DEFAULT_CHANNELS,
  UpdateChannelSchema,
} from "./channel.js";

describe("ChannelGoalTypeSchema (#284)", () => {
  it("'chat' は valid", () => {
    expect(ChannelGoalTypeSchema.parse("chat")).toBe("chat");
  });

  it("'issue' は valid", () => {
    expect(ChannelGoalTypeSchema.parse("issue")).toBe("issue");
  });

  it("不正な値は invalid", () => {
    expect(ChannelGoalTypeSchema.safeParse("zatsudan").success).toBe(false);
    expect(ChannelGoalTypeSchema.safeParse("planning").success).toBe(false);
    expect(ChannelGoalTypeSchema.safeParse("").success).toBe(false);
  });
});

describe("ChannelGoalSchema (#284)", () => {
  it("type のみで parse 成功する", () => {
    expect(ChannelGoalSchema.parse({ type: "chat" })).toEqual({ type: "chat" });
    expect(ChannelGoalSchema.parse({ type: "issue" })).toEqual({ type: "issue" });
  });

  it("type と instructions で parse 成功する", () => {
    const result = ChannelGoalSchema.parse({ type: "chat", instructions: "丁寧に話すこと" });
    expect(result).toEqual({ type: "chat", instructions: "丁寧に話すこと" });
  });

  it("instructions が undefined でも parse 成功する（省略可）", () => {
    expect(ChannelGoalSchema.parse({ type: "issue" })).toEqual({ type: "issue" });
  });

  it(`instructions が ${CHANNEL_GOAL_INSTRUCTIONS_MAX_LENGTH} 文字ちょうどなら parse 成功する`, () => {
    const instructions = "a".repeat(CHANNEL_GOAL_INSTRUCTIONS_MAX_LENGTH);
    expect(ChannelGoalSchema.safeParse({ type: "chat", instructions }).success).toBe(true);
  });

  it(`instructions が ${CHANNEL_GOAL_INSTRUCTIONS_MAX_LENGTH + 1} 文字以上なら parse に失敗する`, () => {
    const instructions = "a".repeat(CHANNEL_GOAL_INSTRUCTIONS_MAX_LENGTH + 1);
    expect(ChannelGoalSchema.safeParse({ type: "chat", instructions }).success).toBe(false);
  });

  it("type が無いと parse に失敗する", () => {
    expect(ChannelGoalSchema.safeParse({}).success).toBe(false);
    expect(ChannelGoalSchema.safeParse({ type: "invalid" }).success).toBe(false);
  });
});

describe("ChannelSchema に goal フィールドが追加されている (#284)", () => {
  it("goal を含む Channel は parse 成功する", () => {
    const result = ChannelSchema.parse({
      id: "zatsudan",
      label: "雑談",
      type: "zatsudan",
      goal: { type: "chat" },
    });
    expect(result.goal).toEqual({ type: "chat" });
  });

  it("goal 省略時はデフォルト { type: 'chat' } になる", () => {
    const result = ChannelSchema.parse({ id: "zatsudan", label: "雑談", type: "zatsudan" });
    expect(result.goal).toEqual({ type: "chat" });
  });

  it("goal.type が 'issue' の Channel も parse 成功する", () => {
    const result = ChannelSchema.parse({
      id: "kikaku",
      label: "企画",
      type: "planning",
      goal: { type: "issue" },
    });
    expect(result.goal.type).toBe("issue");
  });
});

describe("DEFAULT_CHANNELS の goal 値 (#284)", () => {
  it("zatsudan チャンネルは goal.type='chat' を持つ", () => {
    const zatsudan = DEFAULT_CHANNELS.find((c) => c.id === "zatsudan");
    expect(zatsudan?.goal?.type).toBe("chat");
  });

  it("shigoto チャンネルは goal.type='chat' を持つ", () => {
    const shigoto = DEFAULT_CHANNELS.find((c) => c.id === "shigoto");
    expect(shigoto?.goal?.type).toBe("chat");
  });

  it("kikaku チャンネルは goal.type='issue' を持つ", () => {
    const kikaku = DEFAULT_CHANNELS.find((c) => c.id === "kikaku");
    expect(kikaku?.goal?.type).toBe("issue");
  });
});

describe("CreateChannelSchema に goal フィールドが追加されている (#284)", () => {
  it("goal 省略時はデフォルト { type: 'chat' } になる", () => {
    const result = CreateChannelSchema.parse({ label: "新チャンネル" });
    expect(result.goal).toEqual({ type: "chat" });
  });

  it("goal を明示して parse 成功する", () => {
    const result = CreateChannelSchema.parse({
      label: "起票チャンネル",
      goal: { type: "issue" },
    });
    expect(result.goal).toEqual({ type: "issue" });
  });

  it("goal.instructions を指定して parse 成功する", () => {
    const result = CreateChannelSchema.parse({
      label: "チャンネル",
      goal: { type: "chat", instructions: "カジュアルに話す" },
    });
    expect(result.goal.instructions).toBe("カジュアルに話す");
  });
});

describe("UpdateChannelSchema に goal フィールドが追加されている (#284)", () => {
  it("goal のみで parse 成功する", () => {
    const result = UpdateChannelSchema.parse({ goal: { type: "issue" } });
    expect(result.goal).toEqual({ type: "issue" });
  });

  it("label / type / goal のいずれもなければ parse に失敗する", () => {
    expect(UpdateChannelSchema.safeParse({}).success).toBe(false);
  });
});
