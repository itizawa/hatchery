import { describe, expect, it } from "vitest";

import { MAX_MESSAGE_LENGTH, MessageRecordSchema, MessageSchema } from "./message.js";

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

describe("MessageRecordSchema (#40・永続化形)", () => {
  /** 完全な永続化 record の雛形。各テストで一部を上書きして使う。 */
  const base = {
    id: "msg-1",
    speaker: "haru",
    channel: "zatsudan",
    text: "おはよ〜",
    createdAt: new Date("2026-05-31T00:00:00Z"),
    order: 0,
  };

  it("完全な永続化 record は parse 成功する", () => {
    const ok = MessageRecordSchema.parse(base);
    expect(ok).toEqual(base);
  });

  it("order = 0 の境界は parse 成功する", () => {
    expect(MessageRecordSchema.safeParse({ ...base, order: 0 }).success).toBe(true);
  });

  it("text がちょうど MAX_MESSAGE_LENGTH なら parse 成功する（MessageSchema の制約を継承）", () => {
    const exact = "あ".repeat(MAX_MESSAGE_LENGTH);
    expect(MessageRecordSchema.safeParse({ ...base, text: exact }).success).toBe(true);
  });

  it("id が欠損すると parse に失敗する", () => {
    expect(
      MessageRecordSchema.safeParse({
        speaker: base.speaker,
        channel: base.channel,
        text: base.text,
        createdAt: base.createdAt,
        order: base.order,
      }).success,
    ).toBe(false);
  });

  it("createdAt が Date でない（文字列）と parse に失敗する", () => {
    expect(
      MessageRecordSchema.safeParse({ ...base, createdAt: "2026-05-31T00:00:00Z" }).success,
    ).toBe(false);
  });

  it("order が負数だと parse に失敗する", () => {
    expect(MessageRecordSchema.safeParse({ ...base, order: -1 }).success).toBe(false);
  });

  it("order が非整数だと parse に失敗する", () => {
    expect(MessageRecordSchema.safeParse({ ...base, order: 1.5 }).success).toBe(false);
  });

  it("text が空 / MAX_MESSAGE_LENGTH 超だと parse に失敗する", () => {
    expect(MessageRecordSchema.safeParse({ ...base, text: "" }).success).toBe(false);
    const tooLong = "あ".repeat(MAX_MESSAGE_LENGTH + 1);
    expect(MessageRecordSchema.safeParse({ ...base, text: tooLong }).success).toBe(false);
  });

  it("planning 提案フィールドが全て optional で parse 成功する (#76)", () => {
    const withProposal = {
      ...base,
      proposalTitle: "ログインボタンの視認性向上",
      proposalReason: "ボタンの色がコントラスト不足",
      proposalTargetUrl: "/login",
      issueNumber: 99,
      issueUrl: "https://github.com/owner/repo/issues/99",
    };
    const result = MessageRecordSchema.safeParse(withProposal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.proposalTitle).toBe("ログインボタンの視認性向上");
      expect(result.data.issueNumber).toBe(99);
    }
  });

  it("planning 提案フィールドが無くても parse 成功する（optional）(#76)", () => {
    expect(MessageRecordSchema.safeParse(base).success).toBe(true);
  });
});
