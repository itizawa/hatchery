import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchPublicCommunities,
  // 分割先モジュールが communities.ts から後方互換 re-export されることを確認する（#533）。
  fetchPostThread,
  fetchCommunityFeed,
  fetchHomeFeedPage,
  subscribeCommunity,
  unsubscribeCommunity,
  votePost,
  voteComment,
  fetchAdminCommunities,
  createCommunity,
  updateCommunity,
  uploadCommunityImage,
  fetchRecentWorkers,
} from "./communities.js";

/** JSON ボディを持つ Response を組み立てる小ヘルパ。 */
// eslint-disable-next-line max-params
function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const mockCommunity = {
  id: "community-1",
  slug: "ai-dev",
  name: "AI 開発者の集い",
  description: "AI ワーカーが日常を語る community",
  synopsis: undefined,
  last_slot_key: undefined,
  created_at: "2026-06-01T00:00:00Z",
};

describe("fetchPublicCommunities (GET /api/communities)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 のときコミュニティ一覧を返す", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, [mockCommunity]));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchPublicCommunities();
    expect(result).toEqual([mockCommunity]);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/communities");
    expect(request.method).toBe("GET");
  });

  it("エラー応答では例外を投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500)));
    await expect(fetchPublicCommunities()).rejects.toThrow();
  });
});

describe("communities.ts の後方互換 re-export（#533）", () => {
  it("分割先のシンボルを communities.ts から import できる", () => {
    expect(fetchPostThread).toBeTypeOf("function");
    expect(fetchCommunityFeed).toBeTypeOf("function");
    expect(fetchHomeFeedPage).toBeTypeOf("function");
    expect(subscribeCommunity).toBeTypeOf("function");
    expect(unsubscribeCommunity).toBeTypeOf("function");
    expect(votePost).toBeTypeOf("function");
    expect(voteComment).toBeTypeOf("function");
  });
});

// ─── admin 系関数のテスト（#785）────────────────────────────────────────────────

/** AdminCommunitySchema を満たすサーバ応答 DTO（created_at は文字列形式）。 */
const mockAdminCommunityDto = {
  id: "community-1",
  slug: "ai-dev",
  name: "AI 開発者の集い",
  description: "AI ワーカーが日常を語る community",
  created_at: "2026-06-01T00:00:00.000Z",
  post_count: 5,
  last_post_at: null,
};

describe("fetchAdminCommunities (GET /api/admin/communities)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 のとき admin コミュニティ一覧を返す", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, [mockAdminCommunityDto]));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAdminCommunities();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("community-1");
    expect(result[0].created_at).toBeInstanceOf(Date);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/admin/communities");
    expect(request.method).toBe("GET");
  });

  it("エラー応答では例外を投げる", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(403, { error: "Forbidden" })),
    );
    await expect(fetchAdminCommunities()).rejects.toThrow();
  });
});

describe("createCommunity (POST /api/admin/communities)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 のとき作成したコミュニティを返す", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, mockAdminCommunityDto));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createCommunity({
      slug: "ai-dev",
      name: "AI 開発者の集い",
      description: "AI ワーカーが日常を語る community",
    });

    expect(result.id).toBe("community-1");
    expect(result.created_at).toBeInstanceOf(Date);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/admin/communities");
    expect(request.method).toBe("POST");
  });

  it("エラー応答では例外を投げる", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(400, { error: "Bad Request" })),
    );
    await expect(
      createCommunity({
        slug: "ai-dev",
        name: "AI 開発者の集い",
        description: "AI ワーカーが日常を語る community",
      }),
    ).rejects.toThrow();
  });
});

describe("updateCommunity (PATCH /api/admin/communities/:id)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 のとき更新後のコミュニティを返す", async () => {
    const updated = { ...mockAdminCommunityDto, name: "新しい名前" };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, updated));
    vi.stubGlobal("fetch", fetchMock);

    const result = await updateCommunity("community-1", { name: "新しい名前" });

    expect(result.id).toBe("community-1");
    expect(result.name).toBe("新しい名前");
    expect(result.created_at).toBeInstanceOf(Date);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/admin/communities/community-1");
    expect(request.method).toBe("PATCH");
  });

  it("エラー応答では例外を投げる", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(404, { error: "Not Found" })),
    );
    await expect(updateCommunity("missing", { name: "新しい名前" })).rejects.toThrow();
  });
});

describe("fetchRecentWorkers (GET /api/communities/:slug/recent-workers)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 のとき最近のワーカー一覧を返す", async () => {
    const workers = [{ id: "worker-1", displayName: "ハル", role: "エンジニア" }];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, workers));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchRecentWorkers("ai-dev");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("worker-1");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/communities/ai-dev/recent-workers");
    expect(init.credentials).toBe("include");
  });

  it("エラー応答では例外を投げる", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(404, { error: "Not Found" })),
    );
    await expect(fetchRecentWorkers("missing")).rejects.toThrow();
  });
});

describe("uploadCommunityImage (POST /api/admin/communities/:id/:kind)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("multipart リクエストを送り成功時に更新後コミュニティデータを返す", async () => {
    const responseData = {
      id: "community-1",
      iconUrl: "https://example.com/icon.png",
      coverUrl: null,
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, responseData));
    vi.stubGlobal("fetch", fetchMock);

    const file = new File(["dummy"], "icon.png", { type: "image/png" });
    const result = await uploadCommunityImage("community-1", "icon", file);

    expect(result.id).toBe("community-1");
    expect(result.iconUrl).toBe("https://example.com/icon.png");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/admin/communities/community-1/icon");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("image")).toBe(file);
  });

  it("エラー応答では例外を投げる", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(400, { error: "FileTooLarge" })),
    );
    const file = new File(["dummy"], "icon.png", { type: "image/png" });
    await expect(uploadCommunityImage("community-1", "icon", file)).rejects.toThrow();
  });
});
