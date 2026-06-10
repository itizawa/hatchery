/**
 * MSW ハンドラのパスが API クライアントの実パスと一致することを検証するテスト (#198)。
 * handlers をそのまま msw/node の setupServer に載せ、各 API ラッパ関数を呼び出して
 * モックデータが返ること（= ハンドラにマッチした）を確認する。
 * パスがずれていれば fetch が素通りしてエラーになるため、パスずれを自動検知できる。
 *
 * #307: Reddit 風 UI 移行に伴い、旧 /api/messages ハンドラを削除し、新 community API ハンドラに更新。
 */
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { fetchMe } from "../api/auth.js";
import { fetchSettings } from "../api/admin.js";
import { fetchBatchLogs } from "../api/batchLogs.js";
import { fetchPublicCommunities, fetchHomeFeedPage } from "../api/communities.js";
import { mockAdminUser, mockSettings, mockBatchLogs, mockCommunities, mockPosts } from "./data/fixtures.js";
import { handlers } from "./handlers.js";

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("MSW ハンドラのパスが API クライアントの実パスと一致する (#198 / #307)", () => {
  it("fetchMe が /api/auth/me ハンドラにマッチしてモック AuthUser を返す", async () => {
    const result = await fetchMe();
    expect(result).toMatchObject({
      id: mockAdminUser.id,
      displayName: mockAdminUser.displayName,
    });
  });

  it("fetchSettings が /api/admin/settings ハンドラにマッチしてモック設定を返す", async () => {
    const result = await fetchSettings();
    expect(result).toEqual(mockSettings);
  });

  it("fetchBatchLogs が /api/admin/batch-logs ハンドラにマッチしてモックログを返す", async () => {
    const result = await fetchBatchLogs();
    expect(result.length).toBe(mockBatchLogs.length);
    expect(result[0].id).toBe(mockBatchLogs[0].id);
    expect(result[0].status).toBe(mockBatchLogs[0].status);
  });

  it("fetchPublicCommunities が /api/communities ハンドラにマッチしてコミュニティ一覧を返す", async () => {
    const result = await fetchPublicCommunities();
    expect(result.length).toBe(mockCommunities.length);
    expect(result[0].slug).toBe(mockCommunities[0].slug);
  });

  it("fetchHomeFeed が /api/feed ハンドラにマッチしてホームフィードを返す", async () => {
    const result = await fetchHomeFeedPage();
    expect(result.posts.length).toBe(mockPosts.length);
    expect(result.posts[0].id).toBe(mockPosts[0].id);
    expect(result.nextCursor).toBeNull();
  });

  it("POST /api/auth/login ハンドラが存在しモック AuthUser を返す", async () => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "admin-user", password: "pass" }),
    });
    expect(res.ok).toBe(true);
    const data = await res.json() as { id: string };
    expect(data.id).toBe(mockAdminUser.id);
  });
});
