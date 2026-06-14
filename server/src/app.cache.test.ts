import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "./app.js";
import type { AppDeps } from "./app.js";
import { createInMemoryCommunityRepository } from "./persistence/communityRepository.js";
import { createInMemoryPostRepository } from "./persistence/postRepository.js";
import { createTestDeps } from "./testing/createTestDeps.js";

let baseDeps: AppDeps;
beforeEach(() => {
  baseDeps = createTestDeps();
});

const PUBLIC_CACHE = "public, s-maxage=60, stale-while-revalidate=300";
const PRIVATE_NO_STORE = "private, no-store";

async function devLoginCookie(app: ReturnType<typeof createApp>): Promise<string[]> {
  const res = await request(app).post("/api/auth/dev-login");
  expect(res.status).toBe(200);
  return res.headers["set-cookie"] as string[];
}

describe("公開 GET の Cache-Control（#559 AC2）", () => {
  it("GET /api/feed（未認証）は public キャッシュ", async () => {
    const app = createApp(baseDeps);
    const res = await request(app).get("/api/feed");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe(PUBLIC_CACHE);
  });

  it("GET /api/communities（未認証）は public キャッシュ", async () => {
    const app = createApp(baseDeps);
    const res = await request(app).get("/api/communities");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe(PUBLIC_CACHE);
  });

  it("GET /api/communities/:slug/feed（未認証）は public キャッシュ", async () => {
    const communityRepo = createInMemoryCommunityRepository([
      {
        id: "c1",
        slug: "tech",
        name: "Tech",
        description: "d",
        synopsis: null,
        lastSlotKey: null,
        iconUrl: null,
        coverUrl: null,
        generationInstruction: null,
        createdAt: new Date("2026-01-01"),
      },
    ]);
    const deps = createTestDeps({ communityRepository: communityRepo });
    const app = createApp(deps);
    const res = await request(app).get("/api/communities/tech/feed");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe(PUBLIC_CACHE);
  });

  it("GET /api/posts/:postId（未認証）は public キャッシュ", async () => {
    const postRepo = createInMemoryPostRepository();
    const [post] = await postRepo.createMany("c1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "w1", title: "t", text: "b" },
    ]);
    const deps = createTestDeps({ postRepository: postRepo });
    const app = createApp(deps);
    const res = await request(app).get(`/api/posts/${post.id}`);
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe(PUBLIC_CACHE);
  });

  it("GET /sitemap.xml（未認証）は public キャッシュ", async () => {
    const app = createApp(baseDeps);
    const res = await request(app).get("/sitemap.xml");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe(PUBLIC_CACHE);
  });
});

describe("認証済みリクエストは public キャッシュにしない（#559 AC4）", () => {
  it("認証済みの GET /api/feed は private, no-store", async () => {
    const app = createApp(baseDeps);
    const cookie = await devLoginCookie(app);
    const res = await request(app).get("/api/feed").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe(PRIVATE_NO_STORE);
  });

  it("認証済みの GET /api/communities は private, no-store", async () => {
    const app = createApp(baseDeps);
    const cookie = await devLoginCookie(app);
    const res = await request(app).get("/api/communities").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe(PRIVATE_NO_STORE);
  });
});

describe("private 必須 GET の Cache-Control（#559 AC3）", () => {
  it("GET /api/auth/me は private, no-store（public/s-maxage を含まない）", async () => {
    const app = createApp(baseDeps);
    const res = await request(app).get("/api/auth/me");
    expect(res.headers["cache-control"]).toBe(PRIVATE_NO_STORE);
    expect(res.headers["cache-control"]).not.toContain("public");
    expect(res.headers["cache-control"]).not.toContain("s-maxage");
  });

  it("GET /api/communities/:slug/subscription は private, no-store（#421・ユーザー個別）", async () => {
    const communityRepo = createInMemoryCommunityRepository([
      {
        id: "c1",
        slug: "tech",
        name: "Tech",
        description: "d",
        synopsis: null,
        lastSlotKey: null,
        iconUrl: null,
        coverUrl: null,
        generationInstruction: null,
        createdAt: new Date("2026-01-01"),
      },
    ]);
    const deps = createTestDeps({ communityRepository: communityRepo });
    const app = createApp(deps);
    const res = await request(app).get("/api/communities/tech/subscription");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe(PRIVATE_NO_STORE);
    expect(res.headers["cache-control"]).not.toContain("public");
  });

  it("GET /api/admin/* は private, no-store（public/s-maxage を含まない）", async () => {
    const app = createApp(baseDeps);
    const res = await request(app).get("/api/admin/settings");
    expect(res.headers["cache-control"]).toBe(PRIVATE_NO_STORE);
    expect(res.headers["cache-control"]).not.toContain("public");
    expect(res.headers["cache-control"]).not.toContain("s-maxage");
  });

  it("GET /api/admin/token-usage は private, no-store", async () => {
    const app = createApp(baseDeps);
    const res = await request(app).get("/api/admin/token-usage");
    expect(res.headers["cache-control"]).toBe(PRIVATE_NO_STORE);
    expect(res.headers["cache-control"]).not.toContain("public");
  });

  it("GET /api/admin/batch-logs は private, no-store", async () => {
    const app = createApp(baseDeps);
    const res = await request(app).get("/api/admin/batch-logs");
    expect(res.headers["cache-control"]).toBe(PRIVATE_NO_STORE);
    expect(res.headers["cache-control"]).not.toContain("public");
  });
});

describe("書き込み系には public キャッシュを付けない（#559 AC6）", () => {
  it("POST /api/communities/:slug/subscribe は public を含まない", async () => {
    const communityRepo = createInMemoryCommunityRepository([
      {
        id: "c1",
        slug: "tech",
        name: "Tech",
        description: "d",
        synopsis: null,
        lastSlotKey: null,
        iconUrl: null,
        coverUrl: null,
        generationInstruction: null,
        createdAt: new Date("2026-01-01"),
      },
    ]);
    const deps = createTestDeps({ communityRepository: communityRepo });
    const app = createApp(deps);
    const cookie = await devLoginCookie(app);
    const res = await request(app)
      .post("/api/communities/tech/subscribe")
      .set("Cookie", cookie);
    expect(res.headers["cache-control"] ?? "").not.toContain("public");
    expect(res.headers["cache-control"] ?? "").not.toContain("s-maxage");
  });
});

describe("env による秒数上書き（#559 AC1/AC5）", () => {
  it("security.cacheSMaxageSeconds/cacheStaleWhileRevalidateSeconds が public ヘッダに反映される", async () => {
    const app = createApp({
      ...baseDeps,
      security: { cacheSMaxageSeconds: 120, cacheStaleWhileRevalidateSeconds: 600 },
    });
    const res = await request(app).get("/api/feed");
    expect(res.headers["cache-control"]).toBe(
      "public, s-maxage=120, stale-while-revalidate=600",
    );
  });
});
