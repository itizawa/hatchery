import { describe, expect, it } from "vitest";
import {
  AuthUserSchema,
  AppSettingResponseSchema,
  BatchRunLogSchema,
} from "@hatchery/common";

import { mockAdminUser, mockMemberUser, mockSettings, mockBatchLogs } from "./fixtures";

describe("fixtures — Zod スキーマ準拠テスト（#307 Reddit 風 UI）", () => {
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
