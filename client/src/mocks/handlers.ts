import { http, HttpResponse } from "msw";

import {
  mockAdminUser,
  mockCommunities,
  mockPosts,
  mockBatchLogs,
  mockWorkers,
} from "./data/fixtures.js";

/** MSW デフォルトハンドラ。各ストーリーで `parameters.msw.handlers` で上書き可能。 */
export const handlers = [
  http.get("/api/auth/me", () => HttpResponse.json(mockAdminUser)),

  http.get("/api/communities", () => HttpResponse.json(mockCommunities)),

  http.get("/api/communities/:slug/feed", () => HttpResponse.json(mockPosts)),

  http.get("/api/communities/:slug/workers", () =>
    HttpResponse.json({ items: mockWorkers, nextCursor: null }),
  ),

  // GET /api/communities/:slug/subscription — 購読状態（#421 / #461: SubscriptionStatus が useSuspenseQuery で取得・notify_enabled は #1088）。
  http.get("/api/communities/:slug/subscription", () =>
    HttpResponse.json({ subscribed: false, notify_enabled: true }),
  ),

  http.post("/api/communities/:slug/subscribe", () =>
    HttpResponse.json({ userId: "user-1", communityId: "community-1" }, { status: 201 }),
  ),

  http.delete("/api/communities/:slug/subscribe", () => new HttpResponse(null, { status: 204 })),

  http.get("/api/feed", () => HttpResponse.json({ posts: mockPosts, nextCursor: null })),

  http.get("/api/posts/:postId", () => HttpResponse.json({ post: mockPosts[0], comments: [] })),

  // POST /api/posts/:postId/vote — vote（認証不要・#777 ゲスト対応。sessionId を body に含む）。
  http.post("/api/posts/:postId/vote", () =>
    HttpResponse.json({ ...mockPosts[0], score: (mockPosts[0]?.score ?? 0) + 1 }),
  ),

  // POST /api/posts/:postId/view — 閲覧ビーコン（#665）。fire-and-forget なので空ボディで OK。
  http.post("/api/posts/:postId/view", () => new HttpResponse(null, { status: 204 })),

  // POST /api/posts/:postId/comment-views — コメント閲覧ビーコン（#665）。
  http.post("/api/posts/:postId/comment-views", () => new HttpResponse(null, { status: 204 })),

  // POST /api/comments/:commentId/vote — vote（認証不要・#777 ゲスト対応。sessionId を body に含む）。
  http.post("/api/comments/:commentId/vote", () =>
    HttpResponse.json({ id: "comment-1", score: 1 }),
  ),

  // GET /api/subscriptions/unread-counts — 購読コミュニティ未読数（#934）。
  http.get("/api/subscriptions/unread-counts", () =>
    HttpResponse.json({ unread_counts: [] }),
  ),

  // PATCH /api/communities/:slug/mark-viewed — コミュニティ既読化（#934）。
  http.patch("/api/communities/:slug/mark-viewed", () => new HttpResponse(null, { status: 200 })),

  http.get("/api/admin/batch-logs", () => HttpResponse.json(mockBatchLogs)),

  http.post("/api/auth/logout", () => new HttpResponse(null, { status: 200 })),

  http.patch("/api/auth/me", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...mockAdminUser, ...body });
  }),
];
