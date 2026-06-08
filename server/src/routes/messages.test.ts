import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { InMemoryMessageRepository } from "../persistence/messageRepository.js";
import { createTestDeps } from "../testing/createTestDeps.js";

const validMessages = [
  { createdEmployeeId: "e1", channel: "shigoto", text: "今日のタスク確認します" },
];

describe("/api/messages", () => {
  it("POST /api/messages は正しいメッセージ配列を 201 で保存し保存結果を返す", async () => {
    const app = createApp(await createTestDeps());
    const res = await request(app).post("/api/messages").send(validMessages);
    expect(res.status).toBe(201);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBeTruthy();
    expect(res.body[0].createdEmployeeId).toBe("e1");
  });

  it("POST /api/messages は空配列を 400 で拒否する", async () => {
    const app = createApp(await createTestDeps());
    const res = await request(app).post("/api/messages").send([]);
    expect(res.status).toBe(400);
  });

  it("POST /api/messages は不正なメッセージを含む配列を 400 で拒否する", async () => {
    const app = createApp(await createTestDeps());
    const res = await request(app)
      .post("/api/messages")
      .send([{ createdEmployeeId: "", channel: "zatsudan", text: "x" }]);
    expect(res.status).toBe(400);
  });

  it("GET /api/messages は保存済みメッセージ一覧を返す", async () => {
    const repo = new InMemoryMessageRepository();
    const app = createApp(await createTestDeps({ messageRepository: repo }));
    await request(app).post("/api/messages").send(validMessages);
    const res = await request(app).get("/api/messages");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].createdEmployeeId).toBe("e1");
  });
});
