import { describe, expect, it } from "vitest";

import { createInMemoryAppSettingRepository } from "../persistence/appSettingRepository.js";
import { encrypt } from "./crypto.js";
import { getApiKey } from "./apiKey.js";

describe("getApiKey", () => {
  it("DB に CLAUDE_API_KEY が設定済みのとき、復号した値を返す", async () => {
    const plainKey = "sk-ant-api03-test-key-12345";
    const encrypted = encrypt(plainKey);
    const repo = createInMemoryAppSettingRepository([
      { key: "CLAUDE_API_KEY", value: encrypted, updatedAt: new Date() },
    ]);

    const result = await getApiKey(repo, "sk-ant-api03-env-key");

    expect(result).toBe(plainKey);
  });

  it("DB の CLAUDE_API_KEY が復号不能なとき、anthropicApiKey 引数にフォールバックする", async () => {
    const envKey = "sk-ant-api03-env-fallback";
    const repo = createInMemoryAppSettingRepository([
      { key: "CLAUDE_API_KEY", value: "invalid-ciphertext", updatedAt: new Date() },
    ]);

    const result = await getApiKey(repo, envKey);

    expect(result).toBe(envKey);
  });

  it("DB に CLAUDE_API_KEY が設定されていないとき、anthropicApiKey 引数を返す", async () => {
    const envKey = "sk-ant-api03-env-only";
    const repo = createInMemoryAppSettingRepository();

    const result = await getApiKey(repo, envKey);

    expect(result).toBe(envKey);
  });

  it("DB 未設定かつ anthropicApiKey も未指定のとき、undefined を返す", async () => {
    const repo = createInMemoryAppSettingRepository();

    const result = await getApiKey(repo);

    expect(result).toBeUndefined();
  });

  it("DB 未設定かつ anthropicApiKey が undefined のとき、undefined を返す", async () => {
    const repo = createInMemoryAppSettingRepository();

    const result = await getApiKey(repo, undefined);

    expect(result).toBeUndefined();
  });
});
