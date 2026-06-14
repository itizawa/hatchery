import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createNoStoreCache, createPublicCache } from "./cacheControl.js";

/** 認証済みを模す簡易ミドルウェア。req.isAuthenticated()/req.user を立てる。 */
function fakeAuth(): express.RequestHandler {
  return (req, _res, next) => {
    (req as unknown as { isAuthenticated: () => boolean }).isAuthenticated = () => true;
    (req as unknown as { user: { id: string } }).user = { id: "u1" };
    next();
  };
}

describe("createPublicCache（#559 AC2/AC4/AC6）", () => {
  it("未認証 GET には public, s-maxage, stale-while-revalidate を付与する", async () => {
    const app = express();
    app.use(createPublicCache());
    app.get("/x", (_req, res) => res.json({ ok: true }));
    const res = await request(app).get("/x");
    expect(res.headers["cache-control"]).toBe(
      "public, s-maxage=60, stale-while-revalidate=300",
    );
  });

  it("付与する秒数を上書きできる（env 上書き反映・AC1/AC5）", async () => {
    const app = express();
    app.use(createPublicCache({ sMaxageSeconds: 120, staleWhileRevalidateSeconds: 600 }));
    app.get("/x", (_req, res) => res.json({ ok: true }));
    const res = await request(app).get("/x");
    expect(res.headers["cache-control"]).toBe(
      "public, s-maxage=120, stale-while-revalidate=600",
    );
  });

  it("認証済み GET には private, no-store を付与し public を含めない（AC4）", async () => {
    const app = express();
    app.use(fakeAuth());
    app.use(createPublicCache());
    app.get("/x", (_req, res) => res.json({ ok: true }));
    const res = await request(app).get("/x");
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(res.headers["cache-control"]).not.toContain("public");
  });

  it("非 GET（POST）には public を付けない（AC6）", async () => {
    const app = express();
    app.use(createPublicCache());
    app.post("/x", (_req, res) => res.json({ ok: true }));
    const res = await request(app).post("/x");
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(res.headers["cache-control"]).not.toContain("public");
  });

  it("Vary: Cookie を付け Cookie 有無でキャッシュを分離させる", async () => {
    const app = express();
    app.use(createPublicCache());
    app.get("/x", (_req, res) => res.json({ ok: true }));
    const res = await request(app).get("/x");
    expect(res.headers["vary"]).toContain("Cookie");
  });
});

describe("createNoStoreCache（#559 AC3）", () => {
  it("常に private, no-store を付与し public/s-maxage を含めない", async () => {
    const app = express();
    app.use(createNoStoreCache());
    app.get("/x", (_req, res) => res.json({ ok: true }));
    const res = await request(app).get("/x");
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(res.headers["cache-control"]).not.toContain("public");
    expect(res.headers["cache-control"]).not.toContain("s-maxage");
  });
});
