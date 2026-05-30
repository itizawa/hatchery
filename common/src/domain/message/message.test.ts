import { describe, expect, it } from "vitest";

import { MAX_MESSAGE_LENGTH, MessageSchema } from "./message.js";

describe("MessageSchema (A-3)", () => {
  it("正常な発言は parse 成功する", () => {
    const ok = MessageSchema.parse({
      speaker: "haru",
      channel: "zatsudan",
      text: "おはよ〜",
    });
    expect(ok).toEqual({ speaker: "haru", channel: "zatsudan", text: "おはよ〜" });
  });

  it("text が空文字なら parse に失敗する", () => {
    expect(MessageSchema.safeParse({ speaker: "haru", channel: "zatsudan", text: "" }).success).toBe(
      false,
    );
  });

  it("text が MAX_MESSAGE_LENGTH を超えると parse に失敗する", () => {
    const tooLong = "あ".repeat(MAX_MESSAGE_LENGTH + 1);
    expect(
      MessageSchema.safeParse({ speaker: "haru", channel: "zatsudan", text: tooLong }).success,
    ).toBe(false);
  });

  it("text がちょうど MAX_MESSAGE_LENGTH なら parse 成功する", () => {
    const exact = "あ".repeat(MAX_MESSAGE_LENGTH);
    expect(
      MessageSchema.safeParse({ speaker: "haru", channel: "zatsudan", text: exact }).success,
    ).toBe(true);
  });

  it("speaker / channel が空文字なら parse に失敗する", () => {
    expect(MessageSchema.safeParse({ speaker: "", channel: "zatsudan", text: "x" }).success).toBe(
      false,
    );
    expect(MessageSchema.safeParse({ speaker: "haru", channel: "", text: "x" }).success).toBe(false);
  });
});
