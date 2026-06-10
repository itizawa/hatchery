import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { createInMemoryWorkerRepository } from "../persistence/workerRepository.js";
import { createTestUserRepository } from "../persistence/userRepository.js";
import { createTestDeps } from "../testing/createTestDeps.js";

const WORKER_ID = "wrk-testworker";

async function buildApp(workerRepository = createInMemoryWorkerRepository()) {
  const userRepository = await createTestUserRepository("admin");
  const app = createApp(
    await createTestDeps({
      userRepository,
      workerRepository,
    }),
  );
  return { app, workerRepository };
}

async function buildAppWithMember(workerRepository = createInMemoryWorkerRepository()) {
  const userRepository = await createTestUserRepository("member");
  const app = createApp(
    await createTestDeps({
      userRepository,
      workerRepository,
    }),
  );
  return { app, workerRepository };
}

async function loginAsAdmin(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ loginId: "testuser", password: "testpass" });
  return agent;
}

async function loginAsMember(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ loginId: "testuser", password: "testpass" });
  return agent;
}

describe("PATCH /api/workers/:id（admin のみ更新可 / #181）", () => {
  describe("認証", () => {
    it("①未認証だと 401 を返す", async () => {
      const { app } = await buildApp(
        createInMemoryWorkerRepository([
          { id: WORKER_ID, displayName: "Worker", role: null, personality: null, imageUrl: null },
        ]),
      );
      const res = await request(app)
        .patch(`/api/workers/${WORKER_ID}`)
        .send({ displayName: "新名前" });
      expect(res.status).toBe(401);
    });
  });

  describe("認可", () => {
    it("②admin は更新できて 200 を返す", async () => {
      const { app } = await buildApp(
        createInMemoryWorkerRepository([
          { id: WORKER_ID, displayName: "Worker", role: null, personality: null, imageUrl: null },
        ]),
      );
      const agent = await loginAsAdmin(app);
      const res = await agent
        .patch(`/api/workers/${WORKER_ID}`)
        .send({ displayName: "Updated Worker" });
      expect(res.status).toBe(200);
      expect(res.body.displayName).toBe("Updated Worker");
    });

    it("③member は更新できず 403 を返す", async () => {
      const { app } = await buildAppWithMember(
        createInMemoryWorkerRepository([
          { id: WORKER_ID, displayName: "Worker", role: null, personality: null, imageUrl: null },
        ]),
      );
      const agent = await loginAsMember(app);
      const res = await agent
        .patch(`/api/workers/${WORKER_ID}`)
        .send({ displayName: "試み" });
      expect(res.status).toBe(403);
    });
  });

  describe("正常系", () => {
    it("admin が displayName / role / personality を更新すると 200 で更新後の Worker を返す", async () => {
      const { app } = await buildApp(
        createInMemoryWorkerRepository([
          { id: WORKER_ID, displayName: "Worker", role: null, personality: null, imageUrl: null },
        ]),
      );
      const agent = await loginAsAdmin(app);
      const res = await agent
        .patch(`/api/workers/${WORKER_ID}`)
        .send({ displayName: "新表示名", role: "リーダー", personality: "陽気な性格" });
      expect(res.status).toBe(200);
      expect(res.body.displayName).toBe("新表示名");
      expect(res.body.role).toBe("リーダー");
      expect(res.body.personality).toBe("陽気な性格");
    });
  });

  describe("存在しないリソース", () => {
    it("④不存在 Worker への更新は 404 を返す", async () => {
      const { app } = await buildApp(createInMemoryWorkerRepository([]));
      const agent = await loginAsAdmin(app);
      const res = await agent.patch("/api/workers/non-existent-id").send({ displayName: "test" });
      expect(res.status).toBe(404);
    });
  });

  describe("バリデーション", () => {
    it("⑤displayName が 51 文字なら 400 を返す", async () => {
      const { app } = await buildApp(
        createInMemoryWorkerRepository([
          { id: WORKER_ID, displayName: "Worker", role: null, personality: null, imageUrl: null },
        ]),
      );
      const agent = await loginAsAdmin(app);
      const res = await agent
        .patch(`/api/workers/${WORKER_ID}`)
        .send({ displayName: "a".repeat(51) });
      expect(res.status).toBe(400);
    });
  });
});

describe("GET /api/workers（Bot Worker 一覧 / #240）", () => {
  it("認証不要で 200 を返す", async () => {
    const { app } = await buildApp(
      createInMemoryWorkerRepository([
        { id: "bot1", displayName: "Bot", role: "役職", personality: null, imageUrl: null },
      ]),
    );
    const res = await request(app).get("/api/workers");
    expect(res.status).toBe(200);
  });

  // #331: ADR-0020 後処理。Worker は AI 投稿者のみとなり isBot フィルタを撤廃した（全 Worker を返す）。
  it("全 Worker を配列で返す（#331・isBot フィルタ撤廃）", async () => {
    const { app } = await buildApp(
      createInMemoryWorkerRepository([
        { id: "bot1", displayName: "BotA", role: null, personality: null, imageUrl: null },
        { id: "bot2", displayName: "BotB", role: null, personality: null, imageUrl: null },
      ]),
    );
    const res = await request(app).get("/api/workers");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.map((w: { id: string }) => w.id).sort()).toEqual(["bot1", "bot2"]);
    expect(res.body.every((w: object) => !("isBot" in w))).toBe(true);
  });

  it("Bot が存在しない場合は空配列を返す", async () => {
    const { app } = await buildApp(createInMemoryWorkerRepository([]));
    const res = await request(app).get("/api/workers");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("論理削除済み Bot は通常一覧に含まれない（#218）", async () => {
    const { app } = await buildApp(
      createInMemoryWorkerRepository([
        { id: "bot1", displayName: "BotA", role: null, personality: null, deletedAt: new Date() },
      ]),
    );
    const res = await request(app).get("/api/workers");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("includeDeleted=true を指定すると論理削除済み Bot も含まれる（#218）", async () => {
    const { app } = await buildApp(
      createInMemoryWorkerRepository([
        { id: "bot1", displayName: "ActiveBot", role: null, personality: null },
        { id: "bot2", displayName: "DeletedBot", role: null, personality: null, deletedAt: new Date() },
      ]),
    );
    const res = await request(app).get("/api/workers?includeDeleted=true");
    expect(res.status).toBe(200);
    expect(res.body.map((w: { id: string }) => w.id).sort()).toEqual(["bot1", "bot2"]);
  });
});
