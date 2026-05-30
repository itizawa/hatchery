import { SceneSchema } from "@hatchery/common";
import express, { type Express } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { validateBody } from "./validateBody.js";

function appWithValidation(): Express {
  const app = express();
  app.use(express.json());
  app.post("/t", validateBody(SceneSchema), (req, res) => {
    res.status(200).json(req.body);
  });
  return app;
}

describe("validateBody (AC-2 / AC-3)", () => {
  it("正しい Scene は通過し parse 済みボディを次へ渡す", async () => {
    const body = {
      scene: "朝の挨拶",
      messages: [{ speaker: "e1", channel: "zatsudan", text: "やあ" }],
    };
    const res = await request(appWithValidation()).post("/t").send(body);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(body);
  });

  it("messages が空なら 400 と issues を返す", async () => {
    const res = await request(appWithValidation())
      .post("/t")
      .send({ scene: "x", messages: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ValidationError");
    expect(Array.isArray(res.body.issues)).toBe(true);
    expect(res.body.issues.length).toBeGreaterThan(0);
  });

  it("text が空なら 400 を返す", async () => {
    const res = await request(appWithValidation())
      .post("/t")
      .send({ scene: "x", messages: [{ speaker: "e1", channel: "zatsudan", text: "" }] });
    expect(res.status).toBe(400);
  });
});
