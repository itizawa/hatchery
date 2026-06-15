/**
 * フィード API クライアント（#307 / #367 / #435 / #533）。
 * - GET /api/communities/{slug}/feed … コミュニティフィード
 * - GET /api/feed … ホームフィード（カーソルページネーション・並び順）
 */
import { useSuspenseQuery, useSuspenseInfiniteQuery } from "@tanstack/react-query";
import type { HomeFeedSort } from "@hatchery/common";

import { openApiClient } from "./client.js";
import type { Post } from "./posts.js";

// ─── Query Keys ──────────────────────────────────────────────────────────────
export const communityFeedQueryKey = (slug: string) => ["communities", slug, "feed"] as const;
/** ホームフィードのキャッシュキープレフィックス。全 sort をまとめて無効化する際に使う。 */
export const homeFeedQueryKeyPrefix = () => ["feed"] as const;
export const homeFeedQueryKey = (sort: HomeFeedSort = "latest") =>
  [...homeFeedQueryKeyPrefix(), sort] as const;

/**
 * GET /api/communities/{slug}/feed — コミュニティフィードを取得する。
 */
export async function fetchCommunityFeed(slug: string): Promise<Post[]> {
  const { data, response } = await openApiClient.GET("/api/communities/{slug}/feed", {
    params: { path: { slug } },
    credentials: "include",
  });
  if (!response.ok || !data)
    throw new Error(`GET /api/communities/${slug}/feed failed: ${response.status}`);
  return data;
}

/**
 * GET /api/feed — ホームフィードを 1 ページ分取得する（カーソルページネーション #367 / 並び順 #435）。
 * sort=latest（既定）は後方互換のため query に sort を含めない。
 */
export async function fetchHomeFeedPage(
  cursor?: string,
  sort: HomeFeedSort = "latest",
): Promise<{ posts: Post[]; nextCursor: string | null }> {
  const query: { cursor?: string; limit: number; sort?: HomeFeedSort } = { limit: 20 };
  if (cursor) query.cursor = cursor;
  if (sort === "popular") query.sort = sort;
  const { data, response } = await openApiClient.GET("/api/feed", {
    params: { query },
    credentials: "include",
  });
  if (!response.ok || !data) throw new Error(`GET /api/feed failed: ${response.status}`);
  return data as { posts: Post[]; nextCursor: string | null };
}

/**
 * コミュニティフィードを TanStack Query（Suspense）で取得するフック（#462）。
 * data は non-undefined。ローディング/エラーは QueryBoundary に委譲する。
 */
export function useCommunityFeed(slug: string) {
  return useSuspenseQuery({
    queryKey: communityFeedQueryKey(slug),
    queryFn: () => fetchCommunityFeed(slug),
    staleTime: 30_000,
  });
}

/**
 * ホームフィードを TanStack Query（Suspense）の無限スクロールで取得するフック（#367 / 並び順 #435 / #462）。
 * data は non-undefined。ローディング/エラーは QueryBoundary に委譲する。
 */
export function useInfiniteHomeFeed(sort: HomeFeedSort = "latest") {
  return useSuspenseInfiniteQuery({
    queryKey: homeFeedQueryKey(sort),
    queryFn: ({ pageParam }) => fetchHomeFeedPage(pageParam as string | undefined, sort),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
    retry: false,
  });
}
