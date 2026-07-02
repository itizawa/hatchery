/**
 * 投稿全文検索 API クライアント（#751）。
 * GET /api/posts/search の取得とその TanStack Query フックを提供する。
 */
import { useQuery } from "@tanstack/react-query";

import { openApiClient, unwrap } from "./client.js";
import type { components } from "./openapi.gen.js";

export type Post = components["schemas"]["Post"];

/** GET /api/posts/search — title / text の ILIKE 部分一致で最大 50 件・新着順で返す。 */
export async function fetchSearchPosts({ q }: { q: string }): Promise<Post[]> {
  const result = await openApiClient.GET("/api/posts/search", {
    params: { query: { q } },
    credentials: "include",
  });
  return unwrap({ result, label: "GET /api/posts/search" }) as Post[];
}

export const searchPostsQueryKey = (q: string) => ["posts", "search", q] as const;

/**
 * 投稿全文検索を TanStack Query で取得するフック（#751）。
 * q が空または空白のみのときはリクエストしない（enabled: false）。
 */
export function useSearchPosts({ q }: { q: string }) {
  return useQuery({
    queryKey: searchPostsQueryKey(q),
    queryFn: () => fetchSearchPosts({ q }),
    enabled: q.trim().length > 0,
    staleTime: 30_000,
  });
}
