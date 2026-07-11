/**
 * 投稿スレッド（post + comments）API クライアント（#307 / #533）。
 * GET /api/posts/{postId} の取得とその Suspense フックを提供する。
 * pin / unpin（admin 限定・#1089）の API クライアントも提供する。
 */
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { useAuth } from "./auth.js";
import { communityFeedQueryKeyPrefix } from "./feed.js";
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
}): Promise<{ post: Post; comments: Comment[]; related_posts: Post[] }> {
  const query = sessionId ? { sessionId } : undefined;
  const result = await openApiClient.GET("/api/posts/{postId}", {
    params: {
      path: { postId },
      query: query as Record<string, string> | undefined,
    },
    credentials: "include",
  });
  return unwrap({ result, label: `GET /api/posts/${postId}` });
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

/** POST /api/admin/posts/{id}/pin — post を pin する（admin のみ・#1089）。 */
export async function pinPost(id: string): Promise<Post> {
  const result = await openApiClient.POST("/api/admin/posts/{id}/pin", {
    params: { path: { id } },
    credentials: "include",
  });
  return unwrap({ result, label: `POST /api/admin/posts/${id}/pin` });
}

/** DELETE /api/admin/posts/{id}/pin — post の pin を解除する（admin のみ・#1089）。 */
export async function unpinPost(id: string): Promise<Post> {
  const result = await openApiClient.DELETE("/api/admin/posts/{id}/pin", {
    params: { path: { id } },
    credentials: "include",
  });
  return unwrap({ result, label: `DELETE /api/admin/posts/${id}/pin` });
}

/**
 * post を pin する useMutation フック（admin のみ・#1089）。
 * 成功時に対象 community の feed キャッシュ（全 sort）を invalidate する。
 */
export function usePinPost(communitySlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: pinPost,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: communityFeedQueryKeyPrefix(communitySlug) }),
  });
}

/**
 * post の pin を解除する useMutation フック（admin のみ・#1089）。
 * 成功時に対象 community の feed キャッシュ（全 sort）を invalidate する。
 */
export function useUnpinPost(communitySlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unpinPost,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: communityFeedQueryKeyPrefix(communitySlug) }),
  });
}
