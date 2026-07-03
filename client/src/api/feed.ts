/**
 * フィード API クライアント（#307 / #367 / #435 / #533）。
 * - GET /api/communities/{slug}/feed … コミュニティフィード
 * - GET /api/feed … ホームフィード（カーソルページネーション・並び順）
 */
import { useSuspenseQuery, useSuspenseInfiniteQuery } from "@tanstack/react-query";
import type { CommunityFeedSort, HomeFeedSort } from "@hatchery/common";

import { useAuth } from "./auth.js";
import { openApiClient, unwrap } from "./client.js";
import type { Post } from "./posts.js";
import { getOrCreateGuestId } from "./votes.js";

// ─── Query Keys ─────────────────────────────────────────────────────────────────────────────
/** コミュニティフィードのキャッシュキープレフィックス。全 sort をまとめて無効化する際に使う（#886）。 */
export const communityFeedQueryKeyPrefix = (slug: string) =>
  ["communities", slug, "feed"] as const;
export const communityFeedQueryKey = ({ slug, sort = "latest" }: { slug: string; sort?: CommunityFeedSort }) =>
  [...communityFeedQueryKeyPrefix(slug), sort] as const;
/** ホームフィードのキャッシュキープレフィックス。全 sort をまとめて無効化する際に使う。 */
export const homeFeedQueryKeyPrefix = () => ["feed"] as const;
export const homeFeedQueryKey = (sort: HomeFeedSort = "latest") =>
  [...homeFeedQueryKeyPrefix(), sort] as const;

/**
 * GET /api/communities/{slug}/feed — コミュニティフィードを 1 ページ分取得する（#881 カーソルページネーション）。
 * sessionId を付与すると各 post に my_vote が付く（#831）。
 */
export async function fetchCommunityFeedPage({
  slug,
  cursor,
  limit = 20,
  sessionId,
  sort = "latest",
}: {
  slug: string;
  cursor?: string;
  limit?: number;
  sessionId?: string;
  sort?: CommunityFeedSort;
}): Promise<{ posts: Post[]; nextCursor: string | null }> {
  const query: { cursor?: string; limit: number; sessionId?: string; sort?: CommunityFeedSort } = { limit };
  if (cursor) query.cursor = cursor;
  if (sessionId) query.sessionId = sessionId;
  if (sort === "popular") query.sort = sort;
  const result = await openApiClient.GET("/api/communities/{slug}/feed", {
    params: { path: { slug }, query: query as Record<string, string | number | undefined> },
    credentials: "include",
  });
  return unwrap({ result, label: `GET /api/communities/${slug}/feed` }) as {
    posts: Post[];
    nextCursor: string | null;
  };
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
  limit = 20,
}: {
  cursor?: string;
  sort?: HomeFeedSort;
  sessionId?: string;
  limit?: number;
} = {}): Promise<{ posts: Post[]; nextCursor: string | null }> {
  const query: { cursor?: string; limit: number; sort?: HomeFeedSort; sessionId?: string } = {
    limit,
  };
  if (cursor) query.cursor = cursor;
  if (sort === "popular") query.sort = sort;
  if (sessionId) query.sessionId = sessionId;
  const result = await openApiClient.GET("/api/feed", {
    params: { query: query as Record<string, string | number | undefined> },
    credentials: "include",
  });
  return unwrap({ result, label: "GET /api/feed" }) as { posts: Post[]; nextCursor: string | null };
}

/**
 * コミュニティフィードを TanStack Query（Suspense）の無限スクロールで取得するフック（#881 / #831）。
 * sessionId を付与してサーバに my_vote を問い合わせる。
 */
export function useInfiniteCommunityFeed({ slug, sort = "latest" }: { slug: string; sort?: CommunityFeedSort }) {
  const { data: authUser } = useAuth();
  const sessionId = authUser?.id ?? getOrCreateGuestId();
  return useSuspenseInfiniteQuery({
    queryKey: communityFeedQueryKey({ slug, sort }),
    queryFn: ({ pageParam }) =>
      fetchCommunityFeedPage({ slug, cursor: pageParam as string | undefined, sessionId, sort }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
    retry: false,
  });
}

/**
 * サイドバー用新着ポストのキャッシュキー。
 * "feed" プレフィックスを避けてvote ミューテーションの cancelQueries / getQueriesData 対象外にする（#928）。
 * homeFeedQueryKeyPrefix() = ["feed"] に合致すると onMutate が pages 構造を期待して TypeError を起こす。
 */
export const recentPostsSidebarQueryKey = () => ["recent-posts-sidebar"] as const;

/**
 * 右サイドバー用に最新 10 件のホームフィードを取得するフック（#928）。
 * 無限スクロール不要のため useSuspenseQuery で単一ページ取得する。
 */
export function useRecentPostsSidebar() {
  return useSuspenseQuery({
    queryKey: recentPostsSidebarQueryKey(),
    queryFn: () => fetchHomeFeedPage({ sort: "latest", limit: 10 }),
    staleTime: 30_000,
    select: (data) => data.posts,
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
