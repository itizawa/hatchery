import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "./app.js";
import { InMemoryMessageRepository } from "./persistence/messageRepository.js";

describe("createApp のセキュリティ防御", () => {
  it("レート制限の上限を超えたリクエストに 429 を返す（/health にグローバル適用）", async () => {
    const app = createApp({
      messageRepository: new InMemoryMessageRepository(),
      security: { rateLimitMax: 2, rateLimitWindowMs: 60_000 },
    });
    const agent = request(app);
    expect((await agent.get("/health")).status).toBe(200);
    expect((await agent.get("/health")).status).toBe(200);
    const res = await agent.get("/health");
    expect(res.status).toBe(429);
    expect(res.body.error).toBe("TooManyRequests");
  });

  it("ボディサイズ上限を超えるリクエストに 413 を返す", async () => {
    const app = createApp({
      messageRepository: new InMemoryMessageRepository(),
      security: { bodyLimit: "1kb" },
    });
    const big = [{ speaker: "e1", channel: "shigoto", text: "x".repeat(4000) }];
    const res = await request(app).post("/messages").send(big);
    expect(res.status).toBe(413);
    expect(res.body.error).toBe("PayloadTooLarge");
  });
});
