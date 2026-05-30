import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { InMemoryMessageRepository } from "../persistence/messageRepository.js";

const validMessages = [
  { speaker: "e1", channel: "shigoto", text: "今日のタスク確認します" },
];

describe("/messages", () => {
  it("POST /messages は正しいメッセージ配列を 201 で保存し保存結果を返す", async () => {
    const app = createApp({ messageRepository: new InMemoryMessageRepository() });
    const res = await request(app).post("/messages").send(validMessages);
    expect(res.status).toBe(201);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBeTruthy();
    expect(res.body[0].speaker).toBe("e1");
  });

  it("POST /messages は空配列を 400 で拒否する", async () => {
    const app = createApp({ messageRepository: new InMemoryMessageRepository() });
    const res = await request(app).post("/messages").send([]);
    expect(res.status).toBe(400);
  });

  it("POST /messages は不正なメッセージを含む配列を 400 で拒否する", async () => {
    const app = createApp({ messageRepository: new InMemoryMessageRepository() });
    const res = await request(app)
      .post("/messages")
      .send([{ speaker: "", channel: "zatsudan", text: "x" }]);
    expect(res.status).toBe(400);
  });

  it("GET /messages は保存済みメッセージ一覧を返す", async () => {
    const repo = new InMemoryMessageRepository();
    const app = createApp({ messageRepository: repo });
    await request(app).post("/messages").send(validMessages);
    const res = await request(app).get("/messages");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].speaker).toBe("e1");
  });
});
