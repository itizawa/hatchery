/**
 * 投稿スレッド（post + comments）API クライアント（#307 / #533）。
 * GET /api/posts/{postId} の取得とその Suspense フックを提供する。
 */
import { useSuspenseQuery } from "@tanstack/react-query";

import { openApiClient } from "./client.js";
import type { components } from "./openapi.gen.js";

// ─── 公開 API 向け型定義（openapi.gen.ts より）────────────────────────────────────
export type Post = components["schemas"]["Post"];
export type Comment = components["schemas"]["Comment"];

// ─── Query Keys ──────────────────────────────────────────────────────────────
export const postThreadQueryKey = (postId: string) => ["posts", postId] as const;

/**
 * GET /api/posts/{postId} — スレッド（post + comments）を取得する。
 */
export async function fetchPostThread(
  postId: string,
): Promise<{ post: Post; comments: Comment[] }> {
  const { data, response } = await openApiClient.GET("/api/posts/{postId}", {
    params: { path: { postId } },
    credentials: "include",
  });
  if (!response.ok || !data)
    throw new Error(`GET /api/posts/${postId} failed: ${response.status}`);
  return data;
}

/**
 * スレッド（post + comments）を TanStack Query（Suspense）で取得するフック（#462）。
 * data は non-undefined。ローディング/エラーは QueryBoundary に委譲する。
 */
export function usePostThread(postId: string) {
  return useSuspenseQuery({
    queryKey: postThreadQueryKey(postId),
    queryFn: () => fetchPostThread(postId),
    staleTime: 30_000,
  });
}
