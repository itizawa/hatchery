import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createCors } from "./cors.js";

function appWith(allowedOrigins: string[]) {
  const app = express();
  app.use(createCors({ allowedOrigins }));
  app.get("/x", (_req, res) => {
    res.json({ ok: true });
  });
  app.post("/x", (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

const ALLOWED = "https://app.example.com";
const DENIED = "https://evil.example.com";

describe("createCors", () => {
  it("許可オリジンには ACAO を反映し Allow-Credentials と Vary を付与する", async () => {
    const res = await request(appWith([ALLOWED])).get("/x").set("Origin", ALLOWED);
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe(ALLOWED);
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
    expect(res.headers["vary"]).toContain("Origin");
  });

  it("不許可オリジンには ACAO を付与しない", async () => {
    const res = await request(appWith([ALLOWED])).get("/x").set("Origin", DENIED);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("許可オリジンのプリフライトに 204 と Allow-Methods/Headers を返す", async () => {
    const res = await request(appWith([ALLOWED]))
      .options("/x")
      .set("Origin", ALLOWED)
      .set("Access-Control-Request-Method", "POST");
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe(ALLOWED);
    expect(res.headers["access-control-allow-methods"]).toContain("POST");
    expect(res.headers["access-control-allow-headers"]).toContain("Content-Type");
  });

  it("許可リストが * のときは任意オリジンを反映する", async () => {
    const res = await request(appWith(["*"])).get("/x").set("Origin", DENIED);
    expect(res.headers["access-control-allow-origin"]).toBe(DENIED);
  });

  it("Origin ヘッダが無いリクエストはそのまま通す", async () => {
    const res = await request(appWith([ALLOWED])).get("/x");
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
