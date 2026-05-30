import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { InMemorySceneRepository } from "../persistence/sceneRepository.js";

const validScene = {
  scene: "朝会",
  messages: [{ speaker: "e1", channel: "shigoto", text: "今日のタスク確認します" }],
};

describe("/scenes (AC-2 / AC-3)", () => {
  it("POST /scenes は正しい Scene を 201 で保存し保存結果を返す", async () => {
    const app = createApp({ sceneRepository: new InMemorySceneRepository() });
    const res = await request(app).post("/scenes").send(validScene);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.scene).toBe("朝会");
    expect(res.body.messages).toHaveLength(1);
  });

  it("POST /scenes は不正な Scene を 400 で拒否する", async () => {
    const app = createApp({ sceneRepository: new InMemorySceneRepository() });
    const res = await request(app).post("/scenes").send({ scene: "", messages: [] });
    expect(res.status).toBe(400);
  });

  it("GET /scenes は保存済みシーン一覧を返す", async () => {
    const repo = new InMemorySceneRepository();
    const app = createApp({ sceneRepository: repo });
    await request(app).post("/scenes").send(validScene);
    const res = await request(app).get("/scenes");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].scene).toBe("朝会");
  });
});
