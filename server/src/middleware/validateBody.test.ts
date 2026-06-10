import express, { type Express } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { validateBody } from "./validateBody.js";

const TestSchema = z.array(z.object({ name: z.string().min(1) })).min(1);

function appWithValidation(): Express {
  const app = express();
  app.use(express.json());
  app.post("/t", validateBody(TestSchema), (req, res) => {
    res.status(200).json(req.body);
  });
  return app;
}

describe("validateBody", () => {
  it("正しいボディは通過し parse 済みボディを次へ渡す", async () => {
    const body = [{ name: "test" }];
    const res = await request(appWithValidation()).post("/t").send(body);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(body);
  });

  it("空配列なら 400 と issues を返す", async () => {
    const res = await request(appWithValidation()).post("/t").send([]);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ValidationError");
    expect(Array.isArray(res.body.issues)).toBe(true);
    expect(res.body.issues.length).toBeGreaterThan(0);
  });

  it("name が空なら 400 を返す", async () => {
    const res = await request(appWithValidation()).post("/t").send([{ name: "" }]);
    expect(res.status).toBe(400);
  });
});
