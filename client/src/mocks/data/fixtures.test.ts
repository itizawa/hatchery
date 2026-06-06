import { describe, expect, it } from "vitest";
import {
  AuthUserSchema,
  ChannelSchema,
  MessageRecordSchema,
  AppSettingResponseSchema,
  BatchRunLogSchema,
} from "@hatchery/common";

import { mockAdminUser, mockMemberUser, mockChannels, mockMessages, mockSettings, mockBatchLogs } from "./fixtures";

describe("fixtures — Zod スキーマ準拠テスト（TDD: Issue #108）", () => {
  it("mockAdminUser は AuthUserSchema（role=admin）に準拠する", () => {
    const result = AuthUserSchema.safeParse(mockAdminUser);
    expect(result.success).toBe(true);
    expect(mockAdminUser.role).toBe("admin");
  });

  it("mockMemberUser は AuthUserSchema（role=member）に準拠する", () => {
    const result = AuthUserSchema.safeParse(mockMemberUser);
    expect(result.success).toBe(true);
    expect(mockMemberUser.role).toBe("member");
  });

  it("mockChannels は Channel[] スキーマに準拠する", () => {
    for (const ch of mockChannels) {
      const result = ChannelSchema.safeParse(ch);
      expect(result.success).toBe(true);
    }
  });

  it("mockMessages は MessageRecord[] スキーマに準拠する", () => {
    for (const msg of mockMessages) {
      const result = MessageRecordSchema.safeParse(msg);
      expect(result.success).toBe(true);
    }
  });

  it("mockSettings は AppSettingResponse[] スキーマに準拠する", () => {
    for (const s of mockSettings) {
      const result = AppSettingResponseSchema.safeParse(s);
      expect(result.success).toBe(true);
    }
  });

  it("mockBatchLogs は BatchRunLog[] スキーマに準拠する", () => {
    for (const log of mockBatchLogs) {
      const result = BatchRunLogSchema.safeParse(log);
      expect(result.success).toBe(true);
    }
  });
});
