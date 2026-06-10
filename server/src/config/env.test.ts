import { describe, expect, it } from "vitest";

import { loadEnv } from "./env.js";

describe("loadEnv", () => {
  it("PORT を数値として読み、DATABASE_URL を渡す", () => {
    const env = loadEnv({ PORT: "4000", DATABASE_URL: "postgresql://x" });
    expect(env.port).toBe(4000);
    expect(env.databaseUrl).toBe("postgresql://x");
  });

  it("PORT 未設定なら既定の 3000 を使う", () => {
    const env = loadEnv({});
    expect(env.port).toBe(3000);
    expect(env.databaseUrl).toBeUndefined();
  });

  it("数値でない PORT は ZodError で弾く", () => {
    expect(() => loadEnv({ PORT: "abc" })).toThrow();
  });

  it("セキュリティ設定の既定値を返す", () => {
    const env = loadEnv({});
    expect(env.rateLimitWindowMs).toBe(60_000);
    expect(env.rateLimitMax).toBe(300);
    expect(env.bodyLimit).toBe("100kb");
    expect(env.requestTimeoutMs).toBe(30_000);
  });

  it("セキュリティ設定を環境変数から読み取る", () => {
    const env = loadEnv({
      RATE_LIMIT_WINDOW_MS: "1000",
      RATE_LIMIT_MAX: "5",
      REQUEST_BODY_LIMIT: "200kb",
      REQUEST_TIMEOUT_MS: "5000",
    });
    expect(env.rateLimitWindowMs).toBe(1000);
    expect(env.rateLimitMax).toBe(5);
    expect(env.bodyLimit).toBe("200kb");
    expect(env.requestTimeoutMs).toBe(5000);
  });

  it("不正な RATE_LIMIT_MAX（非正）は ZodError で弾く", () => {
    expect(() => loadEnv({ RATE_LIMIT_MAX: "0" })).toThrow();
  });

  it("CORS_ALLOWED_ORIGINS 未設定なら空配列を返す", () => {
    const env = loadEnv({});
    expect(env.corsAllowedOrigins).toEqual([]);
  });

  it("CORS_ALLOWED_ORIGINS をカンマ区切りで配列化し、前後空白と空要素を除去する", () => {
    const env = loadEnv({
      CORS_ALLOWED_ORIGINS: " https://a.example.com , https://b.example.com ,, ",
    });
    expect(env.corsAllowedOrigins).toEqual(["https://a.example.com", "https://b.example.com"]);
  });

  it("DATABASE_URL に接続タイムアウトパラメータを含む URL がそのまま通過する", () => {
    const urlWithTimeout =
      "postgresql://hatchery:hatchery@localhost:5432/hatchery?schema=public&connect_timeout=10&pool_timeout=10";
    const env = loadEnv({ DATABASE_URL: urlWithTimeout });
    expect(env.databaseUrl).toBe(urlWithTimeout);
  });

  it("SESSION_SECRET が設定されている場合に ServerEnv.sessionSecret として返す", () => {
    const env = loadEnv({ SESSION_SECRET: "my-super-secret" });
    expect(env.sessionSecret).toBe("my-super-secret");
  });

  it("SESSION_SECRET 未設定なら sessionSecret が undefined を返す", () => {
    const env = loadEnv({});
    expect(env.sessionSecret).toBeUndefined();
  });
});
