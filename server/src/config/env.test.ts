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
});
