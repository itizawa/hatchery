import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createInMemoryAppSettingRepository } from "../persistence/appSettingRepository.js";
import { encrypt } from "./crypto.js";
import { getApiKey } from "./apiKey.js";

describe("getApiKey", () => {
  const ORIGINAL_ENV = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = ORIGINAL_ENV;
    }
  });

  it("DB に CLAUDE_API_KEY が設定済みのとき、復号した値を返す", async () => {
    const plainKey = "sk-ant-api03-test-key-12345";
    const encrypted = encrypt(plainKey);
    const repo = createInMemoryAppSettingRepository([
      { key: "CLAUDE_API_KEY", value: encrypted, updatedAt: new Date() },
    ]);

    const result = await getApiKey(repo);

    expect(result).toBe(plainKey);
  });

  it("DB の CLAUDE_API_KEY が復号不能なとき、ANTHROPIC_API_KEY env を返す", async () => {
    const envKey = "sk-ant-api03-env-fallback";
    process.env.ANTHROPIC_API_KEY = envKey;

    const repo = createInMemoryAppSettingRepository([
      { key: "CLAUDE_API_KEY", value: "invalid-ciphertext", updatedAt: new Date() },
    ]);

    const result = await getApiKey(repo);

    expect(result).toBe(envKey);
  });

  it("DB に CLAUDE_API_KEY が設定されていないとき、ANTHROPIC_API_KEY env を返す", async () => {
    const envKey = "sk-ant-api03-env-only";
    process.env.ANTHROPIC_API_KEY = envKey;

    const repo = createInMemoryAppSettingRepository();

    const result = await getApiKey(repo);

    expect(result).toBe(envKey);
  });

  it("DB 未設定かつ env も未設定のとき、undefined を返す", async () => {
    const repo = createInMemoryAppSettingRepository();

    const result = await getApiKey(repo);

    expect(result).toBeUndefined();
  });
});
