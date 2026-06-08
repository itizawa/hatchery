import { describe, expect, it } from "vitest";

import {
  APP_SETTING_KEY_MAX_LENGTH,
  APP_SETTING_VALUE_MAX_LENGTH,
  AppSettingSchema,
  UpdateAppSettingSchema,
} from "./appSetting.js";

describe("AppSettingSchema (.max() 上限 / #91 / #173)", () => {
  it("key が APP_SETTING_KEY_MAX_LENGTH 文字ちょうどなら parse 成功する", () => {
    const result = AppSettingSchema.safeParse({
      key: "a".repeat(APP_SETTING_KEY_MAX_LENGTH),
      value: "val",
      updatedAt: new Date(),
    });
    expect(result.success).toBe(true);
  });

  it("key が APP_SETTING_KEY_MAX_LENGTH + 1 文字なら parse 失敗する", () => {
    const result = AppSettingSchema.safeParse({
      key: "a".repeat(APP_SETTING_KEY_MAX_LENGTH + 1),
      value: "val",
      updatedAt: new Date(),
    });
    expect(result.success).toBe(false);
  });

  it("value は上限なし — DB からの長い値もパースが成功する（読み取り専用スキーマ）", () => {
    const result = AppSettingSchema.safeParse({
      key: "KEY",
      value: "a".repeat(APP_SETTING_VALUE_MAX_LENGTH + 1),
      updatedAt: new Date(),
    });
    expect(result.success).toBe(true);
  });
});

describe("UpdateAppSettingSchema (.max() 上限 / #91 / #173)", () => {
  it("key が APP_SETTING_KEY_MAX_LENGTH 文字ちょうどなら parse 成功する", () => {
    const result = UpdateAppSettingSchema.safeParse({
      key: "a".repeat(APP_SETTING_KEY_MAX_LENGTH),
      value: "val",
    });
    expect(result.success).toBe(true);
  });

  it("key が APP_SETTING_KEY_MAX_LENGTH + 1 文字なら parse 失敗する", () => {
    const result = UpdateAppSettingSchema.safeParse({
      key: "a".repeat(APP_SETTING_KEY_MAX_LENGTH + 1),
      value: "val",
    });
    expect(result.success).toBe(false);
  });

  it("value が APP_SETTING_VALUE_MAX_LENGTH 文字ちょうどなら parse 成功する", () => {
    const result = UpdateAppSettingSchema.safeParse({
      key: "KEY",
      value: "a".repeat(APP_SETTING_VALUE_MAX_LENGTH),
    });
    expect(result.success).toBe(true);
  });

  it("value が APP_SETTING_VALUE_MAX_LENGTH + 1 文字なら parse 失敗する", () => {
    const result = UpdateAppSettingSchema.safeParse({
      key: "KEY",
      value: "a".repeat(APP_SETTING_VALUE_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });
});
