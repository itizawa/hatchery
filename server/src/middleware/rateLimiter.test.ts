import express, { type Express } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createRateLimiter } from "./rateLimiter.js";

function appWithLimiter(options: { windowMs: number; max: number }): Express {
  const app = express();
  app.use(createRateLimiter(options));
  app.get("/t", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

describe("createRateLimiter", () => {
  it("ウィンドウ内は max 件まで通過する", async () => {
    const app = appWithLimiter({ windowMs: 60_000, max: 2 });
    const agent = request(app);
    expect((await agent.get("/t")).status).toBe(200);
    expect((await agent.get("/t")).status).toBe(200);
  });

  it("max を超えると 429 と TooManyRequests を返し Retry-After を付ける", async () => {
    const app = appWithLimiter({ windowMs: 60_000, max: 2 });
    const agent = request(app);
    await agent.get("/t");
    await agent.get("/t");
    const res = await agent.get("/t");
    expect(res.status).toBe(429);
    expect(res.body.error).toBe("TooManyRequests");
    expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("ウィンドウ経過後はカウンタがリセットされ再び通過できる", async () => {
    const app = appWithLimiter({ windowMs: 100, max: 1 });
    const agent = request(app);
    expect((await agent.get("/t")).status).toBe(200);
    expect((await agent.get("/t")).status).toBe(429);
    await new Promise<void>((resolve) => setTimeout(resolve, 150));
    expect((await agent.get("/t")).status).toBe(200);
  });
});
