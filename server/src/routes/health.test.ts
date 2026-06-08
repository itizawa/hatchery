import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { createTestDeps } from "../testing/createTestDeps.js";

describe("GET /health (AC-1)", () => {
  it("200 と { status: 'ok' } を返す", async () => {
    const app = createApp(await createTestDeps());
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
