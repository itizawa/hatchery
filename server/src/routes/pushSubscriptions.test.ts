import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { createInMemoryPushSubscriptionRepository } from "../persistence/inMemoryPushSubscriptionRepository.js";
import { createTestDeps } from "../testing/createTestDeps.js";

describe("POST /api/push-subscriptions", () => {
  it("認証済みで正常な購読情報 → 201 を返す", async () => {
    const deps = createTestDeps();
    const app = createApp(deps);

    const loginRes = await request(app).post("/api/auth/dev-login");
    const cookie = loginRes.headers["set-cookie"] as string[];

    const res = await request(app)
      .post("/api/push-subscriptions")
      .set("Cookie", cookie)
      .send({ endpoint: "https://fcm.example.com/1", p256dh: "key123", auth: "auth123" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
  });

  it("同じ endpoint で再登録 → upsert されて 201 を返す", async () => {
    const pushSubscriptionRepository = createInMemoryPushSubscriptionRepository();
    const deps = createTestDeps({ pushSubscriptionRepository });
    const app = createApp(deps);

    const loginRes = await request(app).post("/api/auth/dev-login");
    const cookie = loginRes.headers["set-cookie"] as string[];

    await request(app)
      .post("/api/push-subscriptions")
      .set("Cookie", cookie)
      .send({ endpoint: "https://fcm.example.com/1", p256dh: "key1", auth: "auth1" });

    const res = await request(app)
      .post("/api/push-subscriptions")
      .set("Cookie", cookie)
      .send({ endpoint: "https://fcm.example.com/1", p256dh: "key2", auth: "auth2" });

    expect(res.status).toBe(201);
    const all = await pushSubscriptionRepository.listAll();
    expect(all).toHaveLength(1);
    expect(all[0].p256dh).toBe("key2");
  });

  it("未認証は 401 を返す", async () => {
    const deps = createTestDeps();
    const app = createApp(deps);

    const res = await request(app)
      .post("/api/push-subscriptions")
      .send({ endpoint: "https://fcm.example.com/1", p256dh: "key1", auth: "auth1" });

    expect(res.status).toBe(401);
  });

  it("endpoint が欠けていると 400 を返す", async () => {
    const deps = createTestDeps();
    const app = createApp(deps);

    const loginRes = await request(app).post("/api/auth/dev-login");
    const cookie = loginRes.headers["set-cookie"] as string[];

    const res = await request(app)
      .post("/api/push-subscriptions")
      .set("Cookie", cookie)
      .send({ p256dh: "key1", auth: "auth1" });

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/push-subscriptions", () => {
  it("認証済みで購読削除 → 204 を返す", async () => {
    const pushSubscriptionRepository = createInMemoryPushSubscriptionRepository();
    const deps = createTestDeps({ pushSubscriptionRepository });
    const app = createApp(deps);

    const loginRes = await request(app).post("/api/auth/dev-login");
    const cookie = loginRes.headers["set-cookie"] as string[];

    await request(app)
      .post("/api/push-subscriptions")
      .set("Cookie", cookie)
      .send({ endpoint: "https://fcm.example.com/1", p256dh: "key1", auth: "auth1" });

    const res = await request(app)
      .delete("/api/push-subscriptions")
      .set("Cookie", cookie)
      .send({ endpoint: "https://fcm.example.com/1" });

    expect(res.status).toBe(204);
    const all = await pushSubscriptionRepository.listAll();
    expect(all).toHaveLength(0);
  });

  it("存在しない endpoint でも 204 を返す（冪等）", async () => {
    const deps = createTestDeps();
    const app = createApp(deps);

    const loginRes = await request(app).post("/api/auth/dev-login");
    const cookie = loginRes.headers["set-cookie"] as string[];

    const res = await request(app)
      .delete("/api/push-subscriptions")
      .set("Cookie", cookie)
      .send({ endpoint: "https://fcm.example.com/nonexistent" });

    expect(res.status).toBe(204);
  });

  it("未認証は 401 を返す", async () => {
    const deps = createTestDeps();
    const app = createApp(deps);

    const res = await request(app)
      .delete("/api/push-subscriptions")
      .send({ endpoint: "https://fcm.example.com/1" });

    expect(res.status).toBe(401);
  });
});
