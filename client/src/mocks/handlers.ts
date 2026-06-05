import { http, HttpResponse } from "msw";

import { mockAdminUser, mockChannels, mockMessages, mockSettings, mockBatchLogs } from "./data/fixtures.js";

/** MSW デフォルトハンドラ。各ストーリーで `parameters.msw.handlers` で上書き可能。 */
export const handlers = [
  http.get("/auth/me", () => HttpResponse.json(mockAdminUser)),

  http.get("/channels", () => HttpResponse.json(mockChannels)),

  http.get("/channels/:channelId/messages", () => HttpResponse.json(mockMessages)),

  http.get("/admin/settings", () => HttpResponse.json(mockSettings)),

  http.get("/admin/batch-logs", () => HttpResponse.json(mockBatchLogs)),

  http.post("/auth/login", () => HttpResponse.json(mockAdminUser)),

  http.post("/auth/logout", () => new HttpResponse(null, { status: 200 })),

  http.patch("/auth/me", async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ ...mockAdminUser, ...body });
  }),
];
