import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { createInMemoryCommunityRepository } from "../persistence/communityRepository.js";
import type { CommunityRecord } from "../persistence/communityRepository.js";
import { createTestDeps } from "../testing/createTestDeps.js";

const BASE_URL = "https://hatchery.pages.dev";

const makeCommunity = (overrides: Partial<CommunityRecord> = {}): CommunityRecord => ({
  id: "community-1",
  slug: "technology",
  name: "Technology",
  description: "テクノロジーコミュニティ",
  synopsis: null,
  lastSlotKey: null,
  iconUrl: null,
  coverUrl: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

/** sitemap 用にテストアプリを組み立てる（#259）。publicBaseUrl は固定値で検証する。 */
async function buildApp(communities: CommunityRecord[]) {
  const communityRepo = createInMemoryCommunityRepository(communities);
  const deps = await createTestDeps({
    communityRepository: communityRepo,
    publicBaseUrl: BASE_URL,
  });
  return createApp(deps);
}

describe("GET /sitemap.xml (#259)", () => {
  it("認証不要で 200 を返す（requireAuth なし）", async () => {
    const app = await buildApp([makeCommunity()]);
    const res = await request(app).get("/sitemap.xml");
    expect(res.status).toBe(200);
  });

  it("Content-Type が application/xml", async () => {
    const app = await buildApp([makeCommunity()]);
    const res = await request(app).get("/sitemap.xml");
    expect(res.headers["content-type"]).toContain("application/xml");
  });

  it("トップページ URL を含む", async () => {
    const app = await buildApp([]);
    const res = await request(app).get("/sitemap.xml");
    expect(res.text).toContain(`<loc>${BASE_URL}/</loc>`);
  });

  it("各 community の /communities/<slug> URL を含む", async () => {
    const app = await buildApp([
      makeCommunity({ id: "c1", slug: "technology" }),
      makeCommunity({ id: "c2", slug: "gaming" }),
    ]);
    const res = await request(app).get("/sitemap.xml");
    expect(res.text).toContain(`<loc>${BASE_URL}/communities/technology</loc>`);
    expect(res.text).toContain(`<loc>${BASE_URL}/communities/gaming</loc>`);
  });

  it("lastSlotKey があれば lastmod に反映する", async () => {
    const app = await buildApp([
      makeCommunity({ slug: "technology", lastSlotKey: "2026-06-10T09:00" }),
    ]);
    const res = await request(app).get("/sitemap.xml");
    // lastSlotKey から導出した ISO 日付を含む
    expect(res.text).toMatch(/<lastmod>2026-06-10/);
  });

  it("lastSlotKey が無ければ createdAt を lastmod に使う", async () => {
    const app = await buildApp([
      makeCommunity({
        slug: "technology",
        lastSlotKey: null,
        createdAt: new Date("2026-01-15T00:00:00.000Z"),
      }),
    ]);
    const res = await request(app).get("/sitemap.xml");
    expect(res.text).toContain("<lastmod>2026-01-15T00:00:00.000Z</lastmod>");
  });

  it("整形式の XML（urlset ルート要素）を返す", async () => {
    const app = await buildApp([makeCommunity()]);
    const res = await request(app).get("/sitemap.xml");
    expect(res.text).toMatch(/^<\?xml/);
    expect(res.text).toContain("<urlset");
    expect(res.text).toContain("</urlset>");
  });
});
