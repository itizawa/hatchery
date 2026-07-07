/**
 * admin community 所属ワーカー編集エンドポイントのテスト（#1079）。
 * - GET /api/admin/communities/:id/workers: 所属ワーカー一覧（id/displayName・admin のみ）
 * - PUT /api/admin/communities/:id/workers: 所属ワーカーを置き換える（admin のみ）
 * - 未認証 401 / member 403 / 存在しない community 404 / 存在しない workerId は 400
 */
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { createInMemoryCommunityRepository } from "../persistence/communityRepository.js";
import { createInMemoryWorkerRepository } from "../persistence/workerRepository.js";
import { createInMemoryWorkerCommunityRepository } from "../persistence/workerCommunityRepository.js";
import { createTestUserRepository } from "../persistence/userRepository.js";
import { createTestDeps } from "../testing/createTestDeps.js";

async function makeApp(opts?: {
  role?: "admin" | "member";
  workers?: { id: string; displayName: string }[];
  withCommunity?: boolean;
}) {
  const role = opts?.role ?? "admin";
  const workers = opts?.workers ?? [{ id: "haru", displayName: "haru" }];
  const workerRepository = createInMemoryWorkerRepository(
    workers.map((w) => ({ ...w, role: null, personality: null, imageUrl: null })),
  );
  const communityRepository = createInMemoryCommunityRepository();
  let communityId = "missing-community";
  if (opts?.withCommunity !== false) {
    const created = await communityRepository.create({
      slug: "tech",
      name: "テック",
      description: "説明",
    });
    communityId = created.id;
  }
  const workerCommunityRepository = createInMemoryWorkerCommunityRepository({
    workers: workers.map((w) => ({ ...w, role: null, personality: null, imageUrl: null, deletedAt: null })),
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
  return { app, communityId, communityRepository, workerCommunityRepository };
}

async function loginAgent(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  await agent.post("/api/auth/dev-login");
  return agent;
}

describe("GET /api/admin/communities/:id/workers（#1079）", () => {
  it("未認証の場合は 401 を返す", async () => {
    const { app, communityId } = await makeApp();
    const res = await request(app).get(`/api/admin/communities/${communityId}/workers`);
    expect(res.status).toBe(401);
  });

  it("member ユーザーは 403 を返す", async () => {
    const { app, communityId } = await makeApp({ role: "member" });
    const agent = await loginAgent(app);
    const res = await agent.get(`/api/admin/communities/${communityId}/workers`);
    expect(res.status).toBe(403);
  });

  it("存在しない community は 404 を返す", async () => {
    const { app, communityId } = await makeApp({ withCommunity: false });
    const agent = await loginAgent(app);
    const res = await agent.get(`/api/admin/communities/${communityId}/workers`);
    expect(res.status).toBe(404);
  });

  it("admin は所属ワーカー一覧を返す（初期は空）", async () => {
    const { app, communityId } = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.get(`/api/admin/communities/${communityId}/workers`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ workers: [] });
  });
});

describe("PUT /api/admin/communities/:id/workers（#1079）", () => {
  it("未認証の場合は 401 を返す", async () => {
    const { app, communityId } = await makeApp();
    const res = await request(app)
      .put(`/api/admin/communities/${communityId}/workers`)
      .send({ workerIds: [] });
    expect(res.status).toBe(401);
  });

  it("member ユーザーは 403 を返す", async () => {
    const { app, communityId } = await makeApp({ role: "member" });
    const agent = await loginAgent(app);
    const res = await agent
      .put(`/api/admin/communities/${communityId}/workers`)
      .send({ workerIds: [] });
    expect(res.status).toBe(403);
  });

  it("存在しない community は 404 を返す", async () => {
    const { app, communityId } = await makeApp({ withCommunity: false });
    const agent = await loginAgent(app);
    const res = await agent
      .put(`/api/admin/communities/${communityId}/workers`)
      .send({ workerIds: [] });
    expect(res.status).toBe(404);
  });

  it("存在しない workerId を含むと 400 を返す", async () => {
    const { app, communityId } = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent
      .put(`/api/admin/communities/${communityId}/workers`)
      .send({ workerIds: ["haru", "missing-worker"] });
    expect(res.status).toBe(400);
  });

  it("バリデーション違反（id 上限超過）で 400 を返す", async () => {
    const { app, communityId } = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent
      .put(`/api/admin/communities/${communityId}/workers`)
      .send({ workerIds: ["x".repeat(65)] });
    expect(res.status).toBe(400);
  });

  it("admin が所属ワーカーを置き換えると 200 と置換後一覧を返す", async () => {
    const { app, communityId } = await makeApp({
      workers: [
        { id: "haru", displayName: "haru" },
        { id: "ken", displayName: "ken" },
      ],
    });
    const agent = await loginAgent(app);

    const res = await agent
      .put(`/api/admin/communities/${communityId}/workers`)
      .send({ workerIds: ["haru", "ken"] });
    expect(res.status).toBe(200);
    expect(
      (res.body as { workers: { id: string; displayName: string }[] }).workers
        .map((w) => w.id)
        .sort(),
    ).toEqual(["haru", "ken"]);

    // GET でも置換結果が反映される
    const getRes = await agent.get(`/api/admin/communities/${communityId}/workers`);
    expect(
      (getRes.body as { workers: { id: string; displayName: string }[] }).workers
        .map((w) => w.id)
        .sort(),
    ).toEqual(["haru", "ken"]);
  });

  it("空配列を送ると所属ワーカーが全解除される", async () => {
    const { app, communityId, workerCommunityRepository } = await makeApp();
    await workerCommunityRepository.setCommunityWorkers(communityId, ["haru"]);
    const agent = await loginAgent(app);

    const res = await agent
      .put(`/api/admin/communities/${communityId}/workers`)
      .send({ workerIds: [] });
    expect(res.status).toBe(200);
    expect((res.body as { workers: unknown[] }).workers).toEqual([]);
  });
});
