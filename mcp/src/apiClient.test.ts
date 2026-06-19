import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "./apiClient.js";

function mockFetch({ status, body }: { status: number; body: unknown }) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

describe("createApiClient (#603)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("listWorkers", () => {
    it("GET /api/workers を正しいヘッダーで呼び出す", async () => {
      const mockData = { workers: [], total: 0, page: 1, limit: 100 };
      const fetchMock = mockFetch({ status: 200, body: mockData });
      vi.stubGlobal("fetch", fetchMock);
      const client = createApiClient({ baseUrl: "https://example.com", adminToken: "token123" });
      const result = await client.listWorkers();
      expect(fetchMock).toHaveBeenCalledWith(
        "https://example.com/api/workers",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({ Authorization: "Bearer token123" }),
        }),
      );
      expect(result).toEqual(mockData);
    });
  });

  describe("createWorker", () => {
    it("POST /api/admin/workers を正しいボディで呼び出す", async () => {
      const mockData = { id: "w1", displayName: "Worker 1" };
      const fetchMock = mockFetch({ status: 201, body: mockData });
      vi.stubGlobal("fetch", fetchMock);
      const client = createApiClient({ baseUrl: "https://example.com", adminToken: "token123" });
      await client.createWorker({ displayName: "Worker 1", role: "engineer" });
      expect(fetchMock).toHaveBeenCalledWith(
        "https://example.com/api/admin/workers",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ displayName: "Worker 1", role: "engineer" }),
        }),
      );
    });
  });

  describe("updateWorker", () => {
    it("PATCH /api/workers/:id を呼び出す", async () => {
      const fetchMock = mockFetch({ status: 200, body: { id: "w1", displayName: "Updated" } });
      vi.stubGlobal("fetch", fetchMock);
      const client = createApiClient({ baseUrl: "https://example.com", adminToken: "token123" });
      await client.updateWorker({ id: "w1", data: { displayName: "Updated" } });
      expect(fetchMock).toHaveBeenCalledWith(
        "https://example.com/api/workers/w1",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });

  describe("listCommunities", () => {
    it("GET /api/admin/communities を呼び出す", async () => {
      const fetchMock = mockFetch({ status: 200, body: [] });
      vi.stubGlobal("fetch", fetchMock);
      const client = createApiClient({ baseUrl: "https://example.com", adminToken: "token123" });
      await client.listCommunities();
      expect(fetchMock).toHaveBeenCalledWith(
        "https://example.com/api/admin/communities",
        expect.objectContaining({ method: "GET" }),
      );
    });
  });

  describe("createCommunity", () => {
    it("POST /api/admin/communities を正しいボディで呼び出す", async () => {
      const fetchMock = mockFetch({ status: 201, body: { id: "c1", slug: "general" } });
      vi.stubGlobal("fetch", fetchMock);
      const client = createApiClient({ baseUrl: "https://example.com", adminToken: "token123" });
      await client.createCommunity({
        slug: "general",
        name: "General",
        description: "General chat",
      });
      expect(fetchMock).toHaveBeenCalledWith(
        "https://example.com/api/admin/communities",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ slug: "general", name: "General", description: "General chat" }),
        }),
      );
    });
  });

  describe("updateCommunity", () => {
    it("PATCH /api/admin/communities/:id を呼び出す", async () => {
      const fetchMock = mockFetch({ status: 200, body: { id: "c1", name: "Updated" } });
      vi.stubGlobal("fetch", fetchMock);
      const client = createApiClient({ baseUrl: "https://example.com", adminToken: "token123" });
      await client.updateCommunity({ id: "c1", data: { name: "Updated" } });
      expect(fetchMock).toHaveBeenCalledWith(
        "https://example.com/api/admin/communities/c1",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });

  describe("assignWorkerToCommunity", () => {
    it("PUT /api/admin/workers/:id/communities を呼び出す", async () => {
      const fetchMock = mockFetch({ status: 200, body: { communityIds: ["c1", "c2"] } });
      vi.stubGlobal("fetch", fetchMock);
      const client = createApiClient({ baseUrl: "https://example.com", adminToken: "token123" });
      await client.assignWorkerToCommunity({ workerId: "w1", communityIds: ["c1", "c2"] });
      expect(fetchMock).toHaveBeenCalledWith(
        "https://example.com/api/admin/workers/w1/communities",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ communityIds: ["c1", "c2"] }),
        }),
      );
    });
  });

  describe("エラーハンドリング", () => {
    it("API が 4xx を返したとき Error を投げる", async () => {
      const fetchMock = mockFetch({ status: 401, body: { error: "Unauthorized" } });
      vi.stubGlobal("fetch", fetchMock);
      const client = createApiClient({ baseUrl: "https://example.com", adminToken: "wrong-token" });
      await expect(client.listWorkers()).rejects.toThrow("API error 401");
    });

    it("API が 5xx を返したとき Error を投げる", async () => {
      const fetchMock = mockFetch({ status: 500, body: { error: "Internal Server Error" } });
      vi.stubGlobal("fetch", fetchMock);
      const client = createApiClient({ baseUrl: "https://example.com", adminToken: "token123" });
      await expect(client.listCommunities()).rejects.toThrow("API error 500");
    });
  });
});
