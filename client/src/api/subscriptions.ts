/**
 * コミュニティ購読 API クライアント（#307 / #421 / #533 / #934）。
 * - POST   /api/communities/{slug}/subscribe … 購読
 * - DELETE /api/communities/{slug}/subscribe … 購読解除
 * - GET    /api/communities/{slug}/subscription … 購読状態
 * - GET    /api/subscriptions/unread-counts … 購読コミュニティ未読数（#934）
 * - PATCH  /api/communities/{slug}/mark-viewed … 購読コミュニティ既読化（#934）
 */
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { ensureOk, openApiClient, unwrap } from "./client.js";
import { homeFeedQueryKeyPrefix } from "./feed.js";

// ─── Query Keys ─────────────────────────────────────────────────────────────────────────────
export const communitySubscriptionQueryKey = (slug: string) =>
  ["communities", slug, "subscription"] as const;

export const unreadCountsQueryKey = () => ["subscriptions", "unread-counts"] as const;

/**
 * POST /api/communities/{slug}/subscribe — コミュニティを購読する。
 */
export async function subscribeCommunity(
  slug: string,
): Promise<{ userId: string; communityId: string }> {
  const result = await openApiClient.POST("/api/communities/{slug}/subscribe", {
    params: { path: { slug } },
    credentials: "include",
  });
  return unwrap({ result, label: `POST /api/communities/${slug}/subscribe` });
}

/**
 * DELETE /api/communities/{slug}/subscribe — コミュニティの購読を解除する。
 */
export async function unsubscribeCommunity(slug: string): Promise<void> {
  const result = await openApiClient.DELETE("/api/communities/{slug}/subscribe", {
    params: { path: { slug } },
    credentials: "include",
  });
  ensureOk({ result, label: `DELETE /api/communities/${slug}/subscribe` });
}

/**
 * GET /api/communities/{slug}/subscription — 購読状態を取得する（#421）。
 * 未認証の場合は { subscribed: false } が返る。
 */
export async function fetchSubscriptionStatus(slug: string): Promise<{ subscribed: boolean }> {
  const res = await fetch(`/api/communities/${encodeURIComponent(slug)}/subscription`, {
    credentials: "include",
  });
  if (!res.ok)
    throw new Error(`GET /api/communities/${slug}/subscription failed: ${res.status}`);
  return res.json() as Promise<{ subscribed: boolean }>;
}

// ─── 未読数 API (#934) ────────────────────────────────────────────────────────────────────────

export type UnreadCount = {
  community_id: string;
  community_slug: string;
  unread_count: number;
};

export type UnreadCountsResponse = {
  unread_counts: UnreadCount[];
};

/** GET /api/subscriptions/unread-counts — 購読コミュニティ別未読投稿数を取得する（#934）。 */
export async function fetchUnreadCounts(): Promise<UnreadCountsResponse> {
  const res = await fetch("/api/subscriptions/unread-counts", { credentials: "include" });
  if (!res.ok) throw new Error(`GET /api/subscriptions/unread-counts failed: ${res.status}`);
  return res.json() as Promise<UnreadCountsResponse>;
}

/** 購読コミュニティ未読数フック。Suspense 化（#934）。 */
export function useUnreadCounts() {
  return useSuspenseQuery({
    queryKey: unreadCountsQueryKey(),
    queryFn: fetchUnreadCounts,
  });
}

/** PATCH /api/communities/{slug}/mark-viewed — コミュニティを既読化する（#934）。 */
export async function markCommunityViewed(slug: string): Promise<void> {
  const res = await fetch(`/api/communities/${encodeURIComponent(slug)}/mark-viewed`, {
    method: "PATCH",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`PATCH /api/communities/${slug}/mark-viewed failed: ${res.status}`);
}

/** コミュニティ既読化ミューテーションフック。成功後に未読数クエリを invalidate する（#934）。 */
export function useMarkCommunityViewed(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markCommunityViewed(slug),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: unreadCountsQueryKey() });
    },
  });
}

// ─── 購読 / 購読解除 ─────────────────────────────────────────────────────────────────────────

/** コミュニティ購読ミューテーションフック。成功後に購読状態クエリを invalidate する（#421）。 */
export function useSubscribe(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => subscribeCommunity(slug),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: communitySubscriptionQueryKey(slug) });
      void queryClient.invalidateQueries({ queryKey: homeFeedQueryKeyPrefix() });
    },
  });
}

/** コミュニティ購読解除ミューテーションフック。成功後に購読状態クエリを invalidate する（#421）。 */
export function useUnsubscribe(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unsubscribeCommunity(slug),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: communitySubscriptionQueryKey(slug) });
      void queryClient.invalidateQueries({ queryKey: homeFeedQueryKeyPrefix() });
    },
  });
}
