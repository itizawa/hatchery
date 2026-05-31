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

  it("全応答にセキュアヘッダを付与し X-Powered-By を除去する（/health に適用）", async () => {
    const app = createApp({ messageRepository: new InMemoryMessageRepository() });
    const res = await request(app).get("/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["x-xss-protection"]).toBe("1; mode=block");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("corsAllowedOrigins に含まれるオリジンへ CORS ヘッダを付与する", async () => {
    const origin = "https://app.example.com";
    const app = createApp({
      messageRepository: new InMemoryMessageRepository(),
      security: { corsAllowedOrigins: [origin] },
    });
    const res = await request(app).get("/health").set("Origin", origin);
    expect(res.headers["access-control-allow-origin"]).toBe(origin);
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });
});
