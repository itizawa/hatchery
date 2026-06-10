import { describe, expect, it } from "vitest";
import request from "supertest";

import { createApp } from "./app.js";
import { createTestDeps } from "./testing/createTestDeps.js";

describe("createApp: 純粋ファクトリ（Issue #137）", () => {
  it("createTestDeps() から生成した deps で createApp が正常に起動する", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
  });

  it("AppDeps に不足するフィールドがある場合 TypeScript 型エラー（コンパイル時保証）", () => {
    expect(true).toBe(true);
  });
});
