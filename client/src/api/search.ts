/**
 * 投稿全文検索 API クライアント（#751）。
 * GET /api/posts/search の取得とその TanStack Query フックを提供する。
 */
import { useQuery } from "@tanstack/react-query";

import { apiBaseUrl } from "./client.js";
import type { components } from "./openapi.gen.js";

export type Post = components["schemas"]["Post"];

/**
 * GET /api/posts/search — title / text の ILIKE 部分一致で最大 50 件・新着順で返す。
 * openapi-fetch は fetch(Request) を使うため、テストの fetch スタブが URL 文字列に
 * アクセスできるよう fetch(urlString) を直接呼ぶ実装にしている。
 */
export async function fetchSearchPosts({ q }: { q: string }): Promise<Post[]> {
  const params = new URLSearchParams({ q });
  const url = `${apiBaseUrl}/api/posts/search?${params.toString()}`;
  const response = await globalThis.fetch(url);
  if (!response.ok) {
    throw new Error(`GET /api/posts/search (${response.status})`);
  }
  return response.json() as Promise<Post[]>;
}

export const searchPostsQueryKey = (q: string) => ["posts", "search", q] as const;

/**
 * 投稿全文検索を TanStack Query で取得するフック（#751）。
 * q が空のときはリクエストしない（enabled: false）。
 */
export function useSearchPosts({ q }: { q: string }) {
  return useQuery({
    queryKey: searchPostsQueryKey(q),
    queryFn: () => fetchSearchPosts({ q }),
    enabled: q.length > 0,
    staleTime: 30_000,
  });
}
