import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createRequestLogger } from "./requestLogger.js";

function appWith(logLines: string[]) {
  const app = express();
  const stream = { write: (msg: string) => logLines.push(msg.trim()) };
  app.use(createRequestLogger(stream));
  app.get("/health", (_req, res) => res.json({ ok: true }));
  return app;
}

describe("createRequestLogger", () => {
  it("GET /health のリクエストログが stream に出力される（メソッド・パス・ステータスを含む）", async () => {
    const lines: string[] = [];
    const app = appWith(lines);
    await request(app).get("/health");
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toContain("GET");
    expect(lines[0]).toContain("/health");
    expect(lines[0]).toContain("200");
  });

  it("存在しないエンドポイントで 404 のログが出る", async () => {
    const lines: string[] = [];
    const app = express();
    const stream = { write: (msg: string) => lines.push(msg.trim()) };
    app.use(createRequestLogger(stream));
    app.use((_req, res) => res.status(404).json({ error: "NotFound" }));
    await request(app).get("/not-found");
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toContain("404");
  });

  describe("NODE_ENV=production", () => {
    const origEnv = process.env.NODE_ENV;
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });
    afterEach(() => {
      process.env.NODE_ENV = origEnv;
    });

    it("combined フォーマット（HTTP バージョンを含む）が出力される", async () => {
      const lines: string[] = [];
      const stream = { write: (msg: string) => lines.push(msg.trim()) };
      const app = express();
      app.use(createRequestLogger(stream));
      app.get("/health", (_req, res) => res.json({ ok: true }));
      await request(app).get("/health");
      expect(lines.length).toBeGreaterThan(0);
      expect(lines[0]).toContain("HTTP/1.");
    });
  });

  describe("NODE_ENV=test かつ stream 未指定", () => {
    const origEnv = process.env.NODE_ENV;
    beforeEach(() => {
      process.env.NODE_ENV = "test";
    });
    afterEach(() => {
      process.env.NODE_ENV = origEnv;
    });

    it("no-op になり next が呼ばれる（コンソール出力なし）", async () => {
      const app = express();
      app.use(createRequestLogger());
      app.get("/health", (_req, res) => res.json({ ok: true }));
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
    });
  });
});
