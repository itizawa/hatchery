import express, { type Express } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { errorHandler } from "./errorHandler.js";
import { createJsonBodyParser, createRequestTimeout } from "./requestLimits.js";

function appWithBodyParser(limit: string): Express {
  const app = express();
  app.use(createJsonBodyParser(limit));
  app.post("/t", (req, res) => {
    res.status(200).json(req.body);
  });
  app.use(errorHandler);
  return app;
}

function appWithTimeout(ms: number, handlerDelayMs: number): Express {
  const app = express();
  app.use(createRequestTimeout(ms));
  app.get("/t", (_req, res) => {
    setTimeout(() => {
      if (!res.headersSent) res.status(200).json({ ok: true });
    }, handlerDelayMs);
  });
  return app;
}

describe("createJsonBodyParser", () => {
  it("上限内の JSON ボディは通過する", async () => {
    const res = await request(appWithBodyParser("1mb")).post("/t").send({ a: "x" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ a: "x" });
  });

  it("上限を超えるボディは 413 PayloadTooLarge を返す", async () => {
    const big = { a: "x".repeat(2000) };
    const res = await request(appWithBodyParser("1kb")).post("/t").send(big);
    expect(res.status).toBe(413);
    expect(res.body.error).toBe("PayloadTooLarge");
  });
});

describe("createRequestTimeout", () => {
  it("規定時間内に完了した応答はそのまま返る", async () => {
    const res = await request(appWithTimeout(300, 10)).get("/t");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("規定時間を超えた処理には 503 RequestTimeout を返す", async () => {
    const res = await request(appWithTimeout(50, 400)).get("/t");
    expect(res.status).toBe(503);
    expect(res.body.error).toBe("RequestTimeout");
  });
});
