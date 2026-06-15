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
} from "./communities.js";

/** JSON ボディを持つ Response を組み立てる小ヘルパ。 */
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
