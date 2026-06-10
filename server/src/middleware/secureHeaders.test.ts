import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createSecureHeaders } from "./secureHeaders.js";

function appWith(enableHsts: boolean) {
  const app = express();
  app.use(createSecureHeaders({ enableHsts }));
  app.get("/x", (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

describe("createSecureHeaders", () => {
  it("必須セキュアヘッダ5種を付与し X-Powered-By を除去する", async () => {
    const res = await request(appWith(false)).get("/x");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["x-xss-protection"]).toBe("1; mode=block");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    expect(res.headers["content-security-policy"]).toBeDefined();
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("Content-Security-Policy が default-src 'none' を含む", async () => {
    const res = await request(appWith(false)).get("/x");
    expect(res.headers["content-security-policy"]).toContain("default-src 'none'");
  });

  it("enableHsts:false では HSTS を付与しない", async () => {
    const res = await request(appWith(false)).get("/x");
    expect(res.headers["strict-transport-security"]).toBeUndefined();
  });

  it("enableHsts:true では HSTS を付与する", async () => {
    const res = await request(appWith(true)).get("/x");
    expect(res.headers["strict-transport-security"]).toContain("max-age=");
  });
});
