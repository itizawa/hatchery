import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchSearchPosts } from "./search.js";

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const mockPost = {
  id: "post-1",
  community_id: "community-1",
  slot_key: "2024-01-01",
  seq: 1,
  author: "worker-1",
  title: "テストタイトル",
  text: "テスト本文",
  score: 5,
  created_at: "2024-01-01T00:00:00Z",
  comment_count: 0,
};

describe("fetchSearchPosts (GET /api/posts/search)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 のとき Post 一覧を返す", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, [mockPost]));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchSearchPosts({ q: "テスト" });
    expect(result).toEqual([mockPost]);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/posts/search");
  });

  it("q パラメータが URL に含まれる", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, []));
    vi.stubGlobal("fetch", fetchMock);

    await fetchSearchPosts({ q: "検索ワード" });
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("q=");
    expect(decodeURIComponent(url)).toContain("検索ワード");
  });

  it("空の結果を正常に返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, [])));
    const result = await fetchSearchPosts({ q: "ヒットしないワード" });
    expect(result).toEqual([]);
  });

  it("400 のとき例外を投げる", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(400, { error: "ValidationError" })),
    );
    await expect(fetchSearchPosts({ q: "" })).rejects.toThrow();
  });

  it("500 のとき例外を投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500)));
    await expect(fetchSearchPosts({ q: "エラー" })).rejects.toThrow();
  });
});
