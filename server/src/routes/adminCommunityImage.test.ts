/**
 * admin community 画像アップロードエンドポイントのテスト（#457）。
 * - POST /api/admin/communities/:id/icon: アイコン画像アップロード（admin のみ）
 * - POST /api/admin/communities/:id/cover: カバー画像アップロード（admin のみ）
 * - 成功時に Community.iconUrl / coverUrl が永続化される
 * - member は 403、未認証は 401、存在しない community は 404
 * - MIME / サイズ制限は worker 実装に合わせる
 */
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { createInMemoryCommunityRepository } from "../persistence/communityRepository.js";
import { createTestUserRepository } from "../persistence/userRepository.js";
import { createTestDeps } from "../testing/createTestDeps.js";
import { InMemoryStorageService } from "../services/storageService.js";

const makeCommunity = () => ({
  id: "comm-1",
  slug: "technology",
  name: "Technology",
  description: "テクノロジーコミュニティ",
  synopsis: null,
  lastSlotKey: null,
  iconUrl: null,
  coverUrl: null,
  createdAt: new Date("2026-01-01"),
});

async function makeApp(role: "admin" | "member" = "admin") {
  const userRepo = await createTestUserRepository(role);
  const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
  const storageService = new InMemoryStorageService();
  const app = createApp(
    await createTestDeps({
      userRepository: userRepo,
      communityRepository: communityRepo,
      storageService,
    }),
  );
  return { app, communityRepo };
}

async function loginAgent(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  await agent.post("/api/auth/dev-login");
  return agent;
}

describe.each([
  { kind: "icon", path: "icon", urlField: "iconUrl" },
  { kind: "cover", path: "cover", urlField: "coverUrl" },
] as const)("POST /api/admin/communities/:id/$path（#457）", ({ path, urlField }) => {
  it("未認証なら 401 を返す", async () => {
    const { app } = await makeApp();
    const res = await request(app)
      .post(`/api/admin/communities/comm-1/${path}`)
      .attach("image", Buffer.from("fake"), { filename: "img.png", contentType: "image/png" });
    expect(res.status).toBe(401);
  });

  it("member ユーザーなら 403 を返す", async () => {
    const { app } = await makeApp("member");
    const agent = await loginAgent(app);
    const res = await agent
      .post(`/api/admin/communities/comm-1/${path}`)
      .attach("image", Buffer.from("fake"), { filename: "img.png", contentType: "image/png" });
    expect(res.status).toBe(403);
  });

  it(`admin が有効な画像をアップロードすると 200 と ${urlField} を返し永続化される`, async () => {
    const { app, communityRepo } = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent
      .post(`/api/admin/communities/comm-1/${path}`)
      .attach("image", Buffer.from("fake-data"), { filename: "img.png", contentType: "image/png" });
    expect(res.status).toBe(200);
    const body = res.body as Record<string, string>;
    expect(typeof body[urlField]).toBe("string");
    expect(body[urlField]).toMatch(new RegExp(`communities/comm-1/${path}/`));
    const refetched = await communityRepo.findById("comm-1");
    expect(refetched?.[urlField as "iconUrl" | "coverUrl"]).toBe(body[urlField]);
  });

  it("存在しない community ID なら 404 を返す", async () => {
    const { app } = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent
      .post(`/api/admin/communities/nonexistent/${path}`)
      .attach("image", Buffer.from("fake"), { filename: "img.png", contentType: "image/png" });
    expect(res.status).toBe(404);
  });

  it("MIME が許可外なら 400 を返す", async () => {
    const { app } = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent
      .post(`/api/admin/communities/comm-1/${path}`)
      .attach("image", Buffer.from("fake"), { filename: "doc.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(400);
  });

  it("ファイルサイズが 5MB を超えると 400 を返す", async () => {
    const { app } = await makeApp();
    const agent = await loginAgent(app);
    const bigBuffer = Buffer.alloc(5 * 1024 * 1024 + 1);
    const res = await agent
      .post(`/api/admin/communities/comm-1/${path}`)
      .attach("image", bigBuffer, { filename: "big.png", contentType: "image/png" });
    expect(res.status).toBe(400);
  });

  it("ファイルが添付されていないなら 400 を返す", async () => {
    const { app } = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.post(`/api/admin/communities/comm-1/${path}`);
    expect(res.status).toBe(400);
  });
});
