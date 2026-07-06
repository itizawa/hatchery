/**
 * 投稿全文検索 API クライアント（#751）。
 * GET /api/posts/search の取得とその TanStack Query フックを提供する。
 */
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "./auth.js";
import { openApiClient, unwrap } from "./client.js";
import type { components } from "./openapi.gen.js";
import { getOrCreateGuestId } from "./votes.js";

export type Post = components["schemas"]["Post"];

/**
 * GET /api/posts/search — title / text の ILIKE 部分一致で最大 50 件・新着順で返す。
 * sessionId を付与すると各 post に my_vote が付く（#1059）。
 */
export async function fetchSearchPosts({ q, sessionId }: { q: string; sessionId?: string }): Promise<Post[]> {
  const result = await openApiClient.GET("/api/posts/search", {
    params: { query: sessionId ? { q, sessionId } : { q } },
    credentials: "include",
  });
  return unwrap({ result, label: "GET /api/posts/search" }) as Post[];
}

export const searchPostsQueryKey = (q: string) => ["posts", "search", q] as const;

/**
 * 投稿全文検索を TanStack Query で取得するフック（#751）。
 * q が空または空白のみのときはリクエストしない（enabled: false）。
 * sessionId を付与してサーバに my_vote を問い合わせる（#1059）。
 */
export function useSearchPosts({ q }: { q: string }) {
  const { data: authUser } = useAuth();
  const sessionId = authUser?.id ?? getOrCreateGuestId();
  return useQuery({
    queryKey: searchPostsQueryKey(q),
    queryFn: () => fetchSearchPosts({ q, sessionId }),
    enabled: q.trim().length > 0,
    staleTime: 30_000,
  });
}
