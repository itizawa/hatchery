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

  it("APP_SECRET が設定されている場合に ServerEnv.appSecret として返す", () => {
    const env = loadEnv({ APP_SECRET: "test-app-secret" });
    expect(env.appSecret).toBe("test-app-secret");
  });

  it("APP_SECRET 未設定なら appSecret が undefined を返す", () => {
    const env = loadEnv({});
    expect(env.appSecret).toBeUndefined();
  });

  it("ANTHROPIC_API_KEY が設定されている場合に env.anthropicApiKey として返す", () => {
    const env = loadEnv({ ANTHROPIC_API_KEY: "sk-ant-api03-test" });
    expect(env.anthropicApiKey).toBe("sk-ant-api03-test");
  });

  it("ANTHROPIC_API_KEY 未設定なら anthropicApiKey が undefined を返す", () => {
    const env = loadEnv({});
    expect(env.anthropicApiKey).toBeUndefined();
  });

  it("ANTHROPIC_API_KEY が空文字のとき anthropicApiKey が undefined を返し loadEnv が throw しない", () => {
    expect(() => loadEnv({ ANTHROPIC_API_KEY: "" })).not.toThrow();
    const env = loadEnv({ ANTHROPIC_API_KEY: "" });
    expect(env.anthropicApiKey).toBeUndefined();
  });

  it("GCS_BUCKET_NAME が設定されている場合に env.gcsBucketName として返す", () => {
    const env = loadEnv({ GCS_BUCKET_NAME: "my-bucket" });
    expect(env.gcsBucketName).toBe("my-bucket");
  });

  it("GCS_BUCKET_NAME 未設定なら gcsBucketName が undefined を返す", () => {
    const env = loadEnv({});
    expect(env.gcsBucketName).toBeUndefined();
  });

  // --- BATCH_MODEL（#389 AC1: モデル選定の設定化） ---

  it("BATCH_MODEL 未設定なら既定の claude-sonnet-4-6 を使う", () => {
    const env = loadEnv({});
    expect(env.batchModel).toBe("claude-sonnet-4-6");
  });

  it("BATCH_MODEL に許可値 claude-haiku-4-5 を設定すると反映される", () => {
    const env = loadEnv({ BATCH_MODEL: "claude-haiku-4-5" });
    expect(env.batchModel).toBe("claude-haiku-4-5");
  });

  it("BATCH_MODEL に許可値 claude-sonnet-4-6 を設定すると反映される", () => {
    const env = loadEnv({ BATCH_MODEL: "claude-sonnet-4-6" });
    expect(env.batchModel).toBe("claude-sonnet-4-6");
  });

  it("不正な BATCH_MODEL は ZodError で弾く（起動時エラー）", () => {
    expect(() => loadEnv({ BATCH_MODEL: "gpt-4" })).toThrow();
  });

  // --- BATCH_RECENT_LIMIT（#389 AC2: 直近ログ件数の設定化） ---

  it("BATCH_RECENT_LIMIT 未設定なら既定の 30 を使う", () => {
    const env = loadEnv({});
    expect(env.batchRecentLimit).toBe(30);
  });

  it("BATCH_RECENT_LIMIT を数値として読み取り反映する", () => {
    const env = loadEnv({ BATCH_RECENT_LIMIT: "10" });
    expect(env.batchRecentLimit).toBe(10);
  });

  it("BATCH_RECENT_LIMIT の下限 1・上限 50 は許容する", () => {
    expect(loadEnv({ BATCH_RECENT_LIMIT: "1" }).batchRecentLimit).toBe(1);
    expect(loadEnv({ BATCH_RECENT_LIMIT: "50" }).batchRecentLimit).toBe(50);
  });

  it("下限未満（0）の BATCH_RECENT_LIMIT は ZodError で弾く", () => {
    expect(() => loadEnv({ BATCH_RECENT_LIMIT: "0" })).toThrow();
  });

  it("上限超過（51）の BATCH_RECENT_LIMIT は ZodError で弾く", () => {
    expect(() => loadEnv({ BATCH_RECENT_LIMIT: "51" })).toThrow();
  });

  it("数値でない BATCH_RECENT_LIMIT は ZodError で弾く", () => {
    expect(() => loadEnv({ BATCH_RECENT_LIMIT: "abc" })).toThrow();
  });

  // --- BATCH_POST_MIN/MAX / BATCH_COMMENT_MIN/MAX（#557: post/comment 件数揺らぎ） ---

  it("BATCH_POST_MIN/MAX 未設定なら既定値（1/3）を使う", () => {
    const env = loadEnv({});
    expect(env.batchPostMin).toBe(1);
    expect(env.batchPostMax).toBe(3);
  });

  it("BATCH_COMMENT_MIN/MAX 未設定なら既定値（1/3）を使う", () => {
    const env = loadEnv({});
    expect(env.batchCommentMin).toBe(1);
    expect(env.batchCommentMax).toBe(3);
  });

  it("BATCH_POST_MIN/MAX を数値として読み取り反映する", () => {
    const env = loadEnv({ BATCH_POST_MIN: "2", BATCH_POST_MAX: "5" });
    expect(env.batchPostMin).toBe(2);
    expect(env.batchPostMax).toBe(5);
  });

  it("BATCH_COMMENT_MIN/MAX を数値として読み取り反映する", () => {
    const env = loadEnv({ BATCH_COMMENT_MIN: "0", BATCH_COMMENT_MAX: "4" });
    expect(env.batchCommentMin).toBe(0);
    expect(env.batchCommentMax).toBe(4);
  });

  it("BATCH_POST_MIN の下限 0・上限 10 は許容する", () => {
    expect(loadEnv({ BATCH_POST_MIN: "0" }).batchPostMin).toBe(0);
    expect(loadEnv({ BATCH_POST_MIN: "10" }).batchPostMin).toBe(10);
  });

  it("BATCH_POST_MAX の下限 0・上限 10 は許容する", () => {
    expect(loadEnv({ BATCH_POST_MAX: "0" }).batchPostMax).toBe(0);
    expect(loadEnv({ BATCH_POST_MAX: "10" }).batchPostMax).toBe(10);
  });

  it("BATCH_POST_MIN が上限超過（11）のとき ZodError で弾く", () => {
    expect(() => loadEnv({ BATCH_POST_MIN: "11" })).toThrow();
  });

  it("BATCH_POST_MAX が上限超過（11）のとき ZodError で弾く", () => {
    expect(() => loadEnv({ BATCH_POST_MAX: "11" })).toThrow();
  });

  it("BATCH_COMMENT_MIN が負数（-1）のとき ZodError で弾く", () => {
    expect(() => loadEnv({ BATCH_COMMENT_MIN: "-1" })).toThrow();
  });

  it("数値でない BATCH_POST_MIN は ZodError で弾く", () => {
    expect(() => loadEnv({ BATCH_POST_MIN: "abc" })).toThrow();
  });
});
