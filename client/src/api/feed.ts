/**
 * フィード API クライアント（#307 / #367 / #435 / #533）。
 * - GET /api/communities/{slug}/feed … コミュニティフィード
 * - GET /api/feed … ホームフィード（カーソルページネーション・並び順）
 */
import { useSuspenseQuery, useSuspenseInfiniteQuery } from "@tanstack/react-query";
import type { HomeFeedSort } from "@hatchery/common";

import { useAuth } from "./auth.js";
import { openApiClient } from "./client.js";
import type { Post } from "./posts.js";
import { getOrCreateGuestId } from "./votes.js";

// ─── Query Keys ──────────────────────────────────────────────────────────────
export const communityFeedQueryKey = (slug: string) => ["communities", slug, "feed"] as const;
/** ホームフィードのキャッシュキープレフィックス。全 sort をまとめて無効化する際に使う。 */
export const homeFeedQueryKeyPrefix = () => ["feed"] as const;
export const homeFeedQueryKey = (sort: HomeFeedSort = "latest") =>
  [...homeFeedQueryKeyPrefix(), sort] as const;

/**
 * GET /api/communities/{slug}/feed — コミュニティフィードを取得する。
 * sessionId を付与すると各 post に my_vote が付く（#831）。
 */
export async function fetchCommunityFeed({
  slug,
  sessionId,
}: {
  slug: string;
  sessionId?: string;
}): Promise<Post[]> {
  const query = sessionId ? { sessionId } : undefined;
  const { data, response } = await openApiClient.GET("/api/communities/{slug}/feed", {
    params: { path: { slug }, query: query as Record<string, string> | undefined },
    credentials: "include",
  });
  if (!response.ok || !data)
    throw new Error(`GET /api/communities/${slug}/feed failed: ${response.status}`);
  return data;
}

/**
 * GET /api/feed — ホームフィードを 1 ページ分取得する（カーソルページネーション #367 / 並び順 #435）。
 * sort=latest（既定）は後方互換のため query に sort を含めない。
 * sessionId を付与すると各 post に my_vote が付く（#831）。
 */
export async function fetchHomeFeedPage({
  cursor,
  sort = "latest",
  sessionId,
}: {
  cursor?: string;
  sort?: HomeFeedSort;
  sessionId?: string;
}): Promise<{ posts: Post[]; nextCursor: string | null }> {
  const query: { cursor?: string; limit: number; sort?: HomeFeedSort; sessionId?: string } = {
    limit: 20,
  };
  if (cursor) query.cursor = cursor;
  if (sort === "popular") query.sort = sort;
  if (sessionId) query.sessionId = sessionId;
  const { data, response } = await openApiClient.GET("/api/feed", {
    params: { query: query as Record<string, string | number | undefined> },
    credentials: "include",
  });
  if (!response.ok || !data) throw new Error(`GET /api/feed failed: ${response.status}`);
  return data as { posts: Post[]; nextCursor: string | null };
}

/**
 * コミュニティフィードを TanStack Query（Suspense）で取得するフック（#462 / #831）。
 * sessionId を付与してサーバに my_vote を問い合わせる。
 */
export function useCommunityFeed(slug: string) {
  const { data: authUser } = useAuth();
  const sessionId = authUser?.id ?? getOrCreateGuestId();
  return useSuspenseQuery({
    queryKey: communityFeedQueryKey(slug),
    queryFn: () => fetchCommunityFeed({ slug, sessionId }),
    staleTime: 30_000,
  });
}

/**
 * ホームフィードを TanStack Query（Suspense）の無限スクロールで取得するフック（#367 / 並び順 #435 / #462 / #831）。
 * sessionId を付与してサーバに my_vote を問い合わせる。
 */
export function useInfiniteHomeFeed(sort: HomeFeedSort = "latest") {
  const { data: authUser } = useAuth();
  const sessionId = authUser?.id ?? getOrCreateGuestId();
  return useSuspenseInfiniteQuery({
    queryKey: homeFeedQueryKey(sort),
    queryFn: ({ pageParam }) =>
      fetchHomeFeedPage({ cursor: pageParam as string | undefined, sort, sessionId }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
    retry: false,
  });
}
