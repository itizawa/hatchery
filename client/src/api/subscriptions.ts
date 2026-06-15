/**
 * コミュニティ購読 API クライアント（#307 / #421 / #533）。
 * - POST   /api/communities/{slug}/subscribe … 購読
 * - DELETE /api/communities/{slug}/subscribe … 購読解除
 * - GET    /api/communities/{slug}/subscription … 購読状態
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { openApiClient } from "./client.js";
import { homeFeedQueryKeyPrefix } from "./feed.js";

// ─── Query Keys ──────────────────────────────────────────────────────────────
export const communitySubscriptionQueryKey = (slug: string) =>
  ["communities", slug, "subscription"] as const;

/**
 * POST /api/communities/{slug}/subscribe — コミュニティを購読する。
 */
export async function subscribeCommunity(
  slug: string,
): Promise<{ userId: string; communityId: string }> {
  const { data, response } = await openApiClient.POST("/api/communities/{slug}/subscribe", {
    params: { path: { slug } },
    credentials: "include",
  });
  if (!response.ok || !data)
    throw new Error(`POST /api/communities/${slug}/subscribe failed: ${response.status}`);
  return data;
}

/**
 * DELETE /api/communities/{slug}/subscribe — コミュニティの購読を解除する。
 */
export async function unsubscribeCommunity(slug: string): Promise<void> {
  const { response } = await openApiClient.DELETE("/api/communities/{slug}/subscribe", {
    params: { path: { slug } },
    credentials: "include",
  });
  if (!response.ok && response.status !== 204)
    throw new Error(`DELETE /api/communities/${slug}/subscribe failed: ${response.status}`);
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
