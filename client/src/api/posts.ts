/**
 * 投稿スレッド（post + comments）API クライアント（#307 / #533）。
 * GET /api/posts/{postId} の取得とその Suspense フックを提供する。
 */
import { useSuspenseQuery } from "@tanstack/react-query";

import { useAuth } from "./auth.js";
import { openApiClient, unwrap } from "./client.js";
import type { components } from "./openapi.gen.js";
import { getOrCreateGuestId } from "./votes.js";

// ─── 公開 API 向け型定義（openapi.gen.ts より）─────────────────────────────────────────────────────
export type Post = components["schemas"]["Post"];
export type Comment = components["schemas"]["Comment"];

// ─── Query Keys ─────────────────────────────────────────────────────────────────────────────
export const postThreadQueryKey = (postId: string) => ["posts", postId] as const;

/**
 * GET /api/posts/{postId} — スレッド（post + comments）を取得する。
 * sessionId を付与すると post / comments に my_vote が付く（#831）。
 */
export async function fetchPostThread({
  postId,
  sessionId,
}: {
  postId: string;
  sessionId?: string;
}): Promise<{ post: Post; comments: Comment[] }> {
  const query = sessionId ? { sessionId } : undefined;
  const result = await openApiClient.GET("/api/posts/{postId}", {
    params: {
      path: { postId },
      query: query as Record<string, string> | undefined,
    },
    credentials: "include",
  });
  return unwrap(result, `GET /api/posts/${postId}`);
}

/**
 * スレッド（post + comments）を TanStack Query（Suspense）で取得するフック（#462 / #831）。
 * sessionId を付与してサーバに my_vote を問い合わせる。
 */
export function usePostThread(postId: string) {
  const { data: authUser } = useAuth();
  const sessionId = authUser?.id ?? getOrCreateGuestId();
  return useSuspenseQuery({
    queryKey: postThreadQueryKey(postId),
    queryFn: () => fetchPostThread({ postId, sessionId }),
    staleTime: 30_000,
  });
}
