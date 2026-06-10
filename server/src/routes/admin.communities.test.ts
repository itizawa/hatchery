/**
 * admin community CRUD エンドポイントのテスト（#310）。
 * - POST /api/admin/communities: community 作成（admin のみ）
 * - PATCH /api/admin/communities/:id: community 編集（admin のみ）
 * - GET /api/admin/communities: community 一覧（admin のみ）
 * - slug 重複は 409
 * - member は 403、未認証は 401
 */
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { createInMemoryCommunityRepository } from "../persistence/communityRepository.js";
import { createTestUserRepository } from "../persistence/userRepository.js";
import { createTestDeps } from "../testing/createTestDeps.js";

async function makeApp(
  communityRepo = createInMemoryCommunityRepository(),
  role: "admin" | "member" = "admin",
) {
  const userRepo = await createTestUserRepository(role);
  return createApp(
    await createTestDeps({
      userRepository: userRepo,
      communityRepository: communityRepo,
    }),
  );
}

async function loginAgent(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ loginId: "testuser", password: "testpass" });
  return agent;
}

describe("GET /api/admin/communities (#310)", () => {
  it("未認証の場合は 401 を返す", async () => {
    const app = await makeApp();
    const res = await request(app).get("/api/admin/communities");
    expect(res.status).toBe(401);
  });

  it("member ユーザーは 403 を返す", async () => {
    const app = await makeApp(createInMemoryCommunityRepository(), "member");
    const agent = await loginAgent(app);
    const res = await agent.get("/api/admin/communities");
    expect(res.status).toBe(403);
  });

  it("admin ユーザーは 200 と community 一覧を返す（未登録時は空配列）", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.get("/api/admin/communities");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("登録済みの community が一覧に含まれる", async () => {
    const repo = createInMemoryCommunityRepository();
    await repo.create({
      slug: "tech-news",
      name: "テックニュース",
      description: "テクノロジーに関するコミュニティ",
    });
    const app = await makeApp(repo);
    const agent = await loginAgent(app);
    const res = await agent.get("/api/admin/communities");
    expect(res.status).toBe(200);
    expect((res.body as Array<{ slug: string }>).some((c) => c.slug === "tech-news")).toBe(true);
  });
});

describe("POST /api/admin/communities (#310)", () => {
  const validBody = {
    slug: "new-community",
    name: "新コミュニティ",
    description: "テスト用コミュニティです。",
  };

  it("未認証の場合は 401 を返す", async () => {
    const app = await makeApp();
    const res = await request(app).post("/api/admin/communities").send(validBody);
    expect(res.status).toBe(401);
  });

  it("member ユーザーは 403 を返す", async () => {
    const app = await makeApp(createInMemoryCommunityRepository(), "member");
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/communities").send(validBody);
    expect(res.status).toBe(403);
  });

  it("admin ユーザーは 201 と作成した community を返す", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/communities").send(validBody);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      slug: "new-community",
      name: "新コミュニティ",
      description: "テスト用コミュニティです。",
    });
    expect(typeof (res.body as { id: string }).id).toBe("string");
  });

  it("slug 重複の場合は 409 を返す", async () => {
    const repo = createInMemoryCommunityRepository();
    await repo.create({ slug: "existing-slug", name: "既存", description: "説明" });
    const app = await makeApp(repo);
    const agent = await loginAgent(app);
    const res = await agent
      .post("/api/admin/communities")
      .send({ ...validBody, slug: "existing-slug" });
    expect(res.status).toBe(409);
  });

  it("slug が空の場合は 400 を返す", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/communities").send({ ...validBody, slug: "" });
    expect(res.status).toBe(400);
  });

  it("slug に大文字が含まれる場合は 400 を返す", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/communities").send({ ...validBody, slug: "InvalidSlug" });
    expect(res.status).toBe(400);
  });

  it("name が空の場合は 400 を返す", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/communities").send({ ...validBody, name: "" });
    expect(res.status).toBe(400);
  });

  it("description が空の場合は 400 を返す", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/communities").send({ ...validBody, description: "" });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/admin/communities/:id (#310)", () => {
  const updateBody = {
    name: "更新後の名前",
    description: "更新後の説明です。",
  };

  async function makeAppWithCommunity(role: "admin" | "member" = "admin") {
    const repo = createInMemoryCommunityRepository();
    const community = await repo.create({
      slug: "test-community",
      name: "テストコミュニティ",
      description: "テスト用です。",
    });
    return { app: await makeApp(repo, role), repo, communityId: community.id };
  }

  it("未認証の場合は 401 を返す", async () => {
    const { app, communityId } = await makeAppWithCommunity();
    const res = await request(app).patch(`/api/admin/communities/${communityId}`).send(updateBody);
    expect(res.status).toBe(401);
  });

  it("member ユーザーは 403 を返す", async () => {
    const { app, communityId } = await makeAppWithCommunity("member");
    const agent = await loginAgent(app);
    const res = await agent.patch(`/api/admin/communities/${communityId}`).send(updateBody);
    expect(res.status).toBe(403);
  });

  it("admin ユーザーは 200 と更新後の community を返す", async () => {
    const { app, communityId } = await makeAppWithCommunity();
    const agent = await loginAgent(app);
    const res = await agent.patch(`/api/admin/communities/${communityId}`).send(updateBody);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: "更新後の名前",
      description: "更新後の説明です。",
    });
  });

  it("存在しない community の更新は 404 を返す", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.patch("/api/admin/communities/nonexistent-id").send(updateBody);
    expect(res.status).toBe(404);
  });

  it("name のみ更新できる", async () => {
    const { app, communityId } = await makeAppWithCommunity();
    const agent = await loginAgent(app);
    const res = await agent.patch(`/api/admin/communities/${communityId}`).send({ name: "名前だけ変更" });
    expect(res.status).toBe(200);
    expect((res.body as { name: string }).name).toBe("名前だけ変更");
    // description は元のまま
    expect((res.body as { description: string }).description).toBe("テスト用です。");
  });

  it("description のみ更新できる", async () => {
    const { app, communityId } = await makeAppWithCommunity();
    const agent = await loginAgent(app);
    const res = await agent
      .patch(`/api/admin/communities/${communityId}`)
      .send({ description: "説明だけ変更" });
    expect(res.status).toBe(200);
    expect((res.body as { description: string }).description).toBe("説明だけ変更");
  });

  it("空文字の name は 400 を返す", async () => {
    const { app, communityId } = await makeAppWithCommunity();
    const agent = await loginAgent(app);
    const res = await agent.patch(`/api/admin/communities/${communityId}`).send({ name: "" });
    expect(res.status).toBe(400);
  });
});
