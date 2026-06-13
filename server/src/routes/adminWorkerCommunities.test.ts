/**
 * admin worker 参加コミュニティ編集エンドポイントのテスト（#490）。
 * - GET /api/admin/workers/:id/communities: 参加コミュニティ id 一覧（admin のみ）
 * - PUT /api/admin/workers/:id/communities: 参加コミュニティを置き換える（admin のみ）
 * - 未認証 401 / member 403 / 存在しない worker 404 / 存在しない communityId は 400
 */
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { createInMemoryCommunityRepository } from "../persistence/communityRepository.js";
import { createInMemoryWorkerRepository } from "../persistence/workerRepository.js";
import { createInMemoryWorkerCommunityRepository } from "../persistence/workerCommunityRepository.js";
import { createTestUserRepository } from "../persistence/userRepository.js";
import { createTestDeps } from "../testing/createTestDeps.js";

const WORKER_ID = "wrk-haru";

async function makeApp(opts?: {
  role?: "admin" | "member";
  withWorker?: boolean;
  communities?: { id: string; slug: string }[];
}) {
  const role = opts?.role ?? "admin";
  const workerRepository = createInMemoryWorkerRepository(
    opts?.withWorker === false
      ? []
      : [{ id: WORKER_ID, displayName: "haru", role: null, personality: null, imageUrl: null }],
  );
  const communityRepository = createInMemoryCommunityRepository();
  for (const c of opts?.communities ?? []) {
    await communityRepository.create({ slug: c.slug, name: c.slug, description: "説明" });
  }
  const workerCommunityRepository = createInMemoryWorkerCommunityRepository({
    workers: [{ id: WORKER_ID, displayName: "haru", role: null, personality: null, imageUrl: null }],
    links: [],
  });
  const userRepository = await createTestUserRepository(role);
  const app = createApp(
    await createTestDeps({
      userRepository,
      workerRepository,
      communityRepository,
      workerCommunityRepository,
    }),
  );
  return { app, communityRepository, workerCommunityRepository };
}

async function loginAgent(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  await agent.post("/api/auth/dev-login");
  return agent;
}

describe("GET /api/admin/workers/:id/communities（#490）", () => {
  it("未認証の場合は 401 を返す", async () => {
    const { app } = await makeApp();
    const res = await request(app).get(`/api/admin/workers/${WORKER_ID}/communities`);
    expect(res.status).toBe(401);
  });

  it("member ユーザーは 403 を返す", async () => {
    const { app } = await makeApp({ role: "member" });
    const agent = await loginAgent(app);
    const res = await agent.get(`/api/admin/workers/${WORKER_ID}/communities`);
    expect(res.status).toBe(403);
  });

  it("存在しない worker は 404 を返す", async () => {
    const { app } = await makeApp({ withWorker: false });
    const agent = await loginAgent(app);
    const res = await agent.get(`/api/admin/workers/${WORKER_ID}/communities`);
    expect(res.status).toBe(404);
  });

  it("admin は参加コミュニティ id 一覧を返す（初期は空）", async () => {
    const { app } = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.get(`/api/admin/workers/${WORKER_ID}/communities`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ communityIds: [] });
  });
});

describe("PUT /api/admin/workers/:id/communities（#490）", () => {
  it("未認証の場合は 401 を返す", async () => {
    const { app } = await makeApp();
    const res = await request(app)
      .put(`/api/admin/workers/${WORKER_ID}/communities`)
      .send({ communityIds: [] });
    expect(res.status).toBe(401);
  });

  it("member ユーザーは 403 を返す", async () => {
    const { app } = await makeApp({ role: "member" });
    const agent = await loginAgent(app);
    const res = await agent
      .put(`/api/admin/workers/${WORKER_ID}/communities`)
      .send({ communityIds: [] });
    expect(res.status).toBe(403);
  });

  it("存在しない worker は 404 を返す", async () => {
    const { app } = await makeApp({ withWorker: false });
    const agent = await loginAgent(app);
    const res = await agent
      .put(`/api/admin/workers/${WORKER_ID}/communities`)
      .send({ communityIds: [] });
    expect(res.status).toBe(404);
  });

  it("存在しない communityId を含むと 400 を返す", async () => {
    const { app, communityRepository } = await makeApp({ communities: [{ id: "x", slug: "tech" }] });
    const list = await communityRepository.list();
    const validId = list[0]!.id;
    const agent = await loginAgent(app);
    const res = await agent
      .put(`/api/admin/workers/${WORKER_ID}/communities`)
      .send({ communityIds: [validId, "missing-id"] });
    expect(res.status).toBe(400);
  });

  it("バリデーション違反（id 上限超過）で 400 を返す", async () => {
    const { app } = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent
      .put(`/api/admin/workers/${WORKER_ID}/communities`)
      .send({ communityIds: ["x".repeat(65)] });
    expect(res.status).toBe(400);
  });

  it("admin が参加コミュニティを置き換えると 200 と置換後 id を返す", async () => {
    const { app, communityRepository } = await makeApp({
      communities: [
        { id: "a", slug: "tech" },
        { id: "b", slug: "life" },
      ],
    });
    const list = await communityRepository.list();
    const ids = list.map((c) => c.id);
    const agent = await loginAgent(app);

    const res = await agent
      .put(`/api/admin/workers/${WORKER_ID}/communities`)
      .send({ communityIds: ids });
    expect(res.status).toBe(200);
    expect((res.body as { communityIds: string[] }).communityIds.sort()).toEqual([...ids].sort());

    // GET でも置換結果が反映される
    const getRes = await agent.get(`/api/admin/workers/${WORKER_ID}/communities`);
    expect((getRes.body as { communityIds: string[] }).communityIds.sort()).toEqual(
      [...ids].sort(),
    );
  });

  it("空配列を送ると参加コミュニティが全解除される", async () => {
    const { app, communityRepository, workerCommunityRepository } = await makeApp({
      communities: [{ id: "a", slug: "tech" }],
    });
    const list = await communityRepository.list();
    await workerCommunityRepository.setWorkerCommunities(WORKER_ID, [list[0]!.id]);
    const agent = await loginAgent(app);

    const res = await agent
      .put(`/api/admin/workers/${WORKER_ID}/communities`)
      .send({ communityIds: [] });
    expect(res.status).toBe(200);
    expect((res.body as { communityIds: string[] }).communityIds).toEqual([]);
  });
});
