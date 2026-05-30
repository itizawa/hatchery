import { describe, expect, it } from "vitest";

// Issue #24: 各ドメインはフォルダ配下の index.ts を公開窓口とする。
// フォルダ index 経由で代表シンボルを import できることを検証する（構成の回帰ガード）。
import { AuthUserSchema, LoginRequestSchema } from "./auth/index.js";
import { CHANNEL_IDS, ChannelSchema, DEFAULT_CHANNELS } from "./channel/index.js";
import { EmployeeSchema } from "./employee/index.js";
import { MAX_MESSAGE_LENGTH, MessageSchema } from "./message/index.js";
import { TaskSchema } from "./task/index.js";

describe("domain フォルダ構成（#24）", () => {
  it("auth フォルダの index からスキーマを参照できる", () => {
    expect(LoginRequestSchema.safeParse({ id: "u", password: "p" }).success).toBe(true);
    expect(AuthUserSchema.safeParse({ id: "u", displayName: "U" }).success).toBe(true);
  });

  it("channel フォルダの index から定義を参照できる", () => {
    expect(CHANNEL_IDS).toEqual(["zatsudan", "shigoto"]);
    expect(DEFAULT_CHANNELS).toHaveLength(2);
    expect(ChannelSchema.safeParse({ id: "zatsudan", label: "#雑談" }).success).toBe(true);
  });

  it("employee フォルダの index からスキーマを参照できる", () => {
    expect(EmployeeSchema.safeParse({ id: "e1", displayName: "社員" }).success).toBe(true);
  });

  it("message フォルダの index からスキーマと定数を参照できる", () => {
    expect(MAX_MESSAGE_LENGTH).toBe(280);
    expect(
      MessageSchema.safeParse({ speaker: "e1", channel: "zatsudan", text: "やあ" }).success,
    ).toBe(true);
  });

  it("task フォルダの index からスキーマを参照できる", () => {
    expect(TaskSchema.safeParse({ id: "t1", text: "やること", status: "new" }).success).toBe(true);
  });
});
