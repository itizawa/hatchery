import { describe, expect, it } from "vitest";

import {
  CHANNEL_IDS,
  ChannelSchema,
  ChannelTypeSchema,
  CreateChannelSchema,
  DEFAULT_CHANNELS,
  UpdateChannelSchema,
  findChannelById,
} from "./channel.js";

describe("Channel / CHANNEL_IDS (A-7)", () => {
  it("CHANNEL_IDS は MVP の 3 チャンネル zatsudan / shigoto / kikaku を含む", () => {
    expect(CHANNEL_IDS).toContain("zatsudan");
    expect(CHANNEL_IDS).toContain("shigoto");
    expect(CHANNEL_IDS).toContain("kikaku");
    expect(CHANNEL_IDS).toHaveLength(3);
  });

  it("Channel は id / label / type / goal を持ち parse 成功する", () => {
    const ok = ChannelSchema.parse({ id: "zatsudan", label: "雑談", type: "zatsudan", goal: { type: "chat" } });
    expect(ok).toEqual({ id: "zatsudan", label: "雑談", type: "zatsudan", goal: { type: "chat" } });
  });

  it("goal 省略時はデフォルト { type: 'chat' } で parse 成功する", () => {
    const ok = ChannelSchema.parse({ id: "zatsudan", label: "雑談", type: "zatsudan" });
    expect(ok.goal).toEqual({ type: "chat" });
  });

  it("id / label が空文字なら parse に失敗する", () => {
    expect(ChannelSchema.safeParse({ id: "", label: "雑談", type: "zatsudan" }).success).toBe(false);
    expect(ChannelSchema.safeParse({ id: "zatsudan", label: "", type: "zatsudan" }).success).toBe(false);
  });

  it("label が 51 文字以上なら parse に失敗する（#91）", () => {
    expect(
      ChannelSchema.safeParse({ id: "zatsudan", label: "a".repeat(51), type: "zatsudan" }).success,
    ).toBe(false);
  });

  it("type が無いと parse に失敗する", () => {
    expect(ChannelSchema.safeParse({ id: "zatsudan", label: "雑談" }).success).toBe(false);
  });

  it("DEFAULT_CHANNELS は CHANNEL_IDS の 3 チャンネルを表現し、全て valid な Channel", () => {
    expect(DEFAULT_CHANNELS.map((c) => c.id)).toEqual([...CHANNEL_IDS]);
    for (const ch of DEFAULT_CHANNELS) {
      expect(ChannelSchema.safeParse(ch).success).toBe(true);
    }
  });

  it("DEFAULT_CHANNELS の zatsudan チャンネルは type='zatsudan' を持つ", () => {
    const zatsudan = DEFAULT_CHANNELS.find((c) => c.id === "zatsudan");
    expect(zatsudan?.type).toBe("zatsudan");
  });

  it("DEFAULT_CHANNELS の shigoto チャンネルは type='task' を持つ", () => {
    const shigoto = DEFAULT_CHANNELS.find((c) => c.id === "shigoto");
    expect(shigoto?.type).toBe("task");
  });

  it("DEFAULT_CHANNELS に kikaku チャンネルが type='planning' で含まれる (#76)", () => {
    const kikaku = DEFAULT_CHANNELS.find((c) => c.id === "kikaku");
    expect(kikaku).toBeDefined();
    expect(kikaku?.label).toBe("企画");
    expect(kikaku?.type).toBe("planning");
  });
});

describe("ChannelTypeSchema（#54 / #76）", () => {
  it("'zatsudan' は valid", () => {
    expect(ChannelTypeSchema.parse("zatsudan")).toBe("zatsudan");
  });

  it("'task' は valid", () => {
    expect(ChannelTypeSchema.parse("task")).toBe("task");
  });

  it("'planning' は valid (#76)", () => {
    expect(ChannelTypeSchema.parse("planning")).toBe("planning");
  });

  it("不正な値は invalid", () => {
    expect(ChannelTypeSchema.safeParse("invalid").success).toBe(false);
    expect(ChannelTypeSchema.safeParse("").success).toBe(false);
  });
});

describe("CreateChannelSchema（POST /channels ボディ・#47 / #54）", () => {
  it("label のみ（type 省略）で parse すると type='zatsudan'・goal={type:'chat'} がデフォルトになる", () => {
    const result = CreateChannelSchema.parse({ label: "#新規" });
    expect(result.label).toBe("#新規");
    expect(result.type).toBe("zatsudan");
    expect(result.goal).toEqual({ type: "chat" });
  });

  it("type='task' を明示すると task で作成される", () => {
    const result = CreateChannelSchema.parse({ label: "仕事", type: "task" });
    expect(result.label).toBe("仕事");
    expect(result.type).toBe("task");
  });

  it("label が空文字なら parse に失敗する（400 の根拠）", () => {
    expect(CreateChannelSchema.safeParse({ label: "" }).success).toBe(false);
  });

  it("label が無いと parse に失敗する", () => {
    expect(CreateChannelSchema.safeParse({}).success).toBe(false);
  });

  it("label が 51 文字以上なら parse に失敗する（#91）", () => {
    expect(CreateChannelSchema.safeParse({ label: "a".repeat(51) }).success).toBe(false);
  });
});

describe("UpdateChannelSchema（PATCH /channels/:id ボディ・#54）", () => {
  it("label のみで parse 成功する", () => {
    const result = UpdateChannelSchema.parse({ label: "新しい名前" });
    expect(result.label).toBe("新しい名前");
  });

  it("type のみで parse 成功する", () => {
    const result = UpdateChannelSchema.parse({ type: "task" });
    expect(result.type).toBe("task");
  });

  it("label と type の両方で parse 成功する", () => {
    const result = UpdateChannelSchema.parse({ label: "新しい名前", type: "task" });
    expect(result).toEqual({ label: "新しい名前", type: "task" });
  });

  it("label も type も goal も無ければ parse に失敗する（400 の根拠）", () => {
    expect(UpdateChannelSchema.safeParse({}).success).toBe(false);
  });

  it("label が空文字なら parse に失敗する", () => {
    expect(UpdateChannelSchema.safeParse({ label: "" }).success).toBe(false);
  });

  it("label が 50 文字ちょうどなら parse 成功する（#91）", () => {
    expect(UpdateChannelSchema.safeParse({ label: "a".repeat(50) }).success).toBe(true);
  });

  it("label が 51 文字以上なら parse に失敗する（#91）", () => {
    expect(UpdateChannelSchema.safeParse({ label: "a".repeat(51) }).success).toBe(false);
  });
});

describe("findChannelById", () => {
  it("既知のチャンネル ID から DEFAULT_CHANNELS の Channel を返す", () => {
    expect(findChannelById("zatsudan")).toEqual({ id: "zatsudan", label: "雑談", type: "zatsudan", goal: { type: "chat" } });
  });

  it("未知のチャンネル ID では undefined を返す", () => {
    expect(findChannelById("does-not-exist")).toBeUndefined();
  });
});
