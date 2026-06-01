import { describe, expect, it } from "vitest";

import { loadClientEnv } from "./env";

describe("loadClientEnv", () => {
  it("有効な VITE_API_BASE_URL を読み apiBaseUrl に格納する", () => {
    const env = loadClientEnv({ VITE_API_BASE_URL: "https://api.example.com" });
    expect(env.apiBaseUrl).toBe("https://api.example.com");
  });

  it("VITE_API_BASE_URL 未設定なら apiBaseUrl は undefined（同一オリジンにフォールバック）", () => {
    const env = loadClientEnv({});
    expect(env.apiBaseUrl).toBeUndefined();
  });

  it("URL でない VITE_API_BASE_URL は ZodError で弾く", () => {
    expect(() => loadClientEnv({ VITE_API_BASE_URL: "not-a-url" })).toThrow();
  });

  it("VITE_LOG_LEVEL 未設定なら既定の info を返す", () => {
    const env = loadClientEnv({});
    expect(env.logLevel).toBe("info");
  });

  it("許可された VITE_LOG_LEVEL を読み取る", () => {
    const env = loadClientEnv({ VITE_LOG_LEVEL: "debug" });
    expect(env.logLevel).toBe("debug");
  });

  it("不正な VITE_LOG_LEVEL は ZodError で弾く", () => {
    expect(() => loadClientEnv({ VITE_LOG_LEVEL: "verbose" })).toThrow();
  });
});
