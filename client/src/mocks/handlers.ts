import { http, HttpResponse } from "msw";

import {
  mockAdminUser,
  mockCommunities,
  mockPosts,
  mockSettings,
  mockBatchLogs,
  mockWorkers,
} from "./data/fixtures.js";

/** MSW デフォルトハンドラ。各ストーリーで `parameters.msw.handlers` で上書き可能。 */
export const handlers = [
  http.get("/api/auth/me", () => HttpResponse.json(mockAdminUser)),

  http.get("/api/communities", () => HttpResponse.json(mockCommunities)),

  http.get("/api/communities/:slug/feed", () => HttpResponse.json(mockPosts)),

  http.get("/api/communities/:slug/recent-workers", () => HttpResponse.json(mockWorkers)),

  // GET /api/communities/:slug/subscription — 購読状態（#421 / #461: SubscriptionStatus が useSuspenseQuery で取得）。
  http.get("/api/communities/:slug/subscription", () => HttpResponse.json({ subscribed: false })),

  http.post("/api/communities/:slug/subscribe", () =>
    HttpResponse.json({ userId: "user-1", communityId: "community-1" }, { status: 201 }),
  ),

  http.delete("/api/communities/:slug/subscribe", () => new HttpResponse(null, { status: 204 })),

  http.get("/api/feed", () => HttpResponse.json({ posts: mockPosts, nextCursor: null })),

  http.get("/api/posts/:postId", () => HttpResponse.json({ post: mockPosts[0], comments: [] })),

  http.post("/api/posts/:postId/vote", () =>
    HttpResponse.json({ ...mockPosts[0], score: (mockPosts[0]?.score ?? 0) + 1 }),
  ),

  http.post("/api/comments/:commentId/vote", () =>
    HttpResponse.json({ id: "comment-1", score: 1 }),
  ),

  http.get("/api/admin/settings", () => HttpResponse.json(mockSettings)),

  http.get("/api/admin/batch-logs", () => HttpResponse.json(mockBatchLogs)),

  http.post("/api/auth/logout", () => new HttpResponse(null, { status: 200 })),

  http.patch("/api/auth/me", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...mockAdminUser, ...body });
  }),
];
