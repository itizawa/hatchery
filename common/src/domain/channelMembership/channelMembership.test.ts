import { describe, expect, it } from "vitest";

import { AddChannelMemberSchema, ChannelMembershipSchema } from "./channelMembership.js";

describe("AddChannelMemberSchema（POST ボディ検証）", () => {
  it("非空の employeeId を受理する", () => {
    expect(AddChannelMemberSchema.safeParse({ employeeId: "haru" }).success).toBe(true);
  });

  it("employeeId が空文字なら拒否する", () => {
    expect(AddChannelMemberSchema.safeParse({ employeeId: "" }).success).toBe(false);
  });

  it("employeeId 欠損なら拒否する", () => {
    expect(AddChannelMemberSchema.safeParse({}).success).toBe(false);
  });
});

describe("ChannelMembershipSchema（所属 1 件）", () => {
  it("channelId / employeeId が揃えば受理する", () => {
    expect(
      ChannelMembershipSchema.safeParse({ channelId: "zatsudan", employeeId: "haru" }).success,
    ).toBe(true);
  });

  it("いずれかが空なら拒否する", () => {
    expect(ChannelMembershipSchema.safeParse({ channelId: "", employeeId: "haru" }).success).toBe(
      false,
    );
    expect(
      ChannelMembershipSchema.safeParse({ channelId: "zatsudan", employeeId: "" }).success,
    ).toBe(false);
  });
});
