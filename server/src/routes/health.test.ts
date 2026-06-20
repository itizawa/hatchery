import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../app.js";
import { createTestDeps } from "../testing/createTestDeps.js";
import { createHealthRouter } from "./health.js";

describe("GET /health (AC-1)", () => {
  it("200 と { status: 'ok' } を返す", async () => {
    const app = createApp(await createTestDeps());
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("createHealthRouter（AC-2: 異常系）", () => {
  function buildApp(healthCheck?: () => Promise<void>) {
    const app = express();
    app.use("/health", createHealthRouter(healthCheck));
    return app;
  }

  it("healthCheck が未指定の場合、200 と { status: 'ok' } を返す", async () => {
    const app = buildApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("healthCheck が正常に解決する場合、200 と { status: 'ok' } を返す", async () => {
    const healthCheck = vi.fn().mockResolvedValue(undefined);
    const app = buildApp(healthCheck);
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
    expect(healthCheck).toHaveBeenCalledOnce();
  });

  it("healthCheck が例外をスローする場合、503 と { status: 'error' } を返す", async () => {
    const healthCheck = vi.fn().mockRejectedValue(new Error("DB connection failed"));
    const app = buildApp(healthCheck);
    const res = await request(app).get("/health");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "error", message: "service unavailable" });
    expect(healthCheck).toHaveBeenCalledOnce();
  });

});
