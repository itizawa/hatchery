import { describe, expect, it } from "vitest";

import { CHANNEL_IDS, ChannelSchema, DEFAULT_CHANNELS } from "./channel.js";

describe("Channel / CHANNEL_IDS (A-7)", () => {
  it("CHANNEL_IDS は MVP の 2 チャンネル zatsudan / shigoto を含む", () => {
    expect(CHANNEL_IDS).toContain("zatsudan");
    expect(CHANNEL_IDS).toContain("shigoto");
    expect(CHANNEL_IDS).toHaveLength(2);
  });

  it("Channel は id と表示ラベルを持ち parse 成功する", () => {
    const ok = ChannelSchema.parse({ id: "zatsudan", label: "#雑談" });
    expect(ok).toEqual({ id: "zatsudan", label: "#雑談" });
  });

  it("id / label が空文字なら parse に失敗する", () => {
    expect(ChannelSchema.safeParse({ id: "", label: "#雑談" }).success).toBe(false);
    expect(ChannelSchema.safeParse({ id: "zatsudan", label: "" }).success).toBe(false);
  });

  it("DEFAULT_CHANNELS は CHANNEL_IDS の 2 チャンネルを表現する", () => {
    expect(DEFAULT_CHANNELS.map((c) => c.id)).toEqual([...CHANNEL_IDS]);
    for (const ch of DEFAULT_CHANNELS) {
      expect(ChannelSchema.safeParse(ch).success).toBe(true);
    }
  });
});
