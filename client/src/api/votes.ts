/**
 * 投票 API クライアント（ADR-0025 / #533）。
 * - POST /api/posts/{postId}/vote … post への up/down vote
 * - POST /api/comments/{commentId}/vote … comment への up/down vote
 * 楽観更新 + キャッシュ無効化フックを提供する。
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { VoteDirection } from "@hatchery/common";

import { openApiClient } from "./client.js";
import { postThreadQueryKey, type Post, type Comment } from "./posts.js";
import { communityFeedQueryKey, homeFeedQueryKeyPrefix } from "./feed.js";

export type { VoteDirection };

/**
 * POST /api/posts/{postId}/vote — post に up/down vote する（ADR-0025）。
 */
// eslint-disable-next-line max-params
export async function votePost(postId: string, direction: VoteDirection): Promise<Post> {
  const { data, response } = await openApiClient.POST("/api/posts/{postId}/vote", {
    params: { path: { postId } },
    body: { direction },
    credentials: "include",
  });
  if (!response.ok || !data)
    throw new Error(`POST /api/posts/${postId}/vote failed: ${response.status}`);
  return data;
}

/**
 * POST /api/comments/{commentId}/vote — comment に up/down vote する（ADR-0025）。
 */
// eslint-disable-next-line max-params
export async function voteComment(commentId: string, direction: VoteDirection): Promise<Comment> {
  const { data, response } = await openApiClient.POST("/api/comments/{commentId}/vote", {
    params: { path: { commentId } },
    body: { direction },
    credentials: "include",
  });
  if (!response.ok || !data)
    throw new Error(`POST /api/comments/${commentId}/vote failed: ${response.status}`);
  return data;
}

/** post への vote ミューテーションフック。楽観更新 + キャッシュ無効化（ADR-0025）。 */
export function useVotePost(communitySlug?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, direction }: { postId: string; direction: VoteDirection }) =>
      votePost(postId, direction),
    onMutate: async ({ postId, direction }: { postId: string; direction: VoteDirection }) => {
      // 楽観更新: スレッドキャッシュの score を direction に応じて +1 / -1
      const threadKey = postThreadQueryKey(postId);
      await queryClient.cancelQueries({ queryKey: threadKey });
      const previous = queryClient.getQueryData<{ post: Post; comments: Comment[] }>(threadKey);
      if (previous) {
        queryClient.setQueryData(threadKey, {
          ...previous,
          post: {
            ...previous.post,
            score: previous.post.score + (direction === "up" ? 1 : -1),
          },
        });
      }
      return { previous, postId };
    },
    // eslint-disable-next-line max-params
    onError: (_err, { postId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(postThreadQueryKey(postId), context.previous);
      }
    },
    // eslint-disable-next-line max-params
    onSettled: (_data, _err, { postId }) => {
      void queryClient.invalidateQueries({ queryKey: postThreadQueryKey(postId) });
      if (communitySlug) {
        void queryClient.invalidateQueries({ queryKey: communityFeedQueryKey(communitySlug) });
      }
      void queryClient.invalidateQueries({ queryKey: homeFeedQueryKeyPrefix() });
    },
  });
}

/** comment への vote ミューテーションフック。楽観更新 + キャッシュ無効化（ADR-0025）。 */
export function useVoteComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      commentId,
      direction,
    }: {
      commentId: string;
      direction: VoteDirection;
    }) => voteComment(commentId, direction),
    onMutate: async ({
      commentId,
      direction,
    }: {
      commentId: string;
      direction: VoteDirection;
    }) => {
      // 楽観更新: スレッドキャッシュのコメント score を direction に応じて +1 / -1
      const threadKey = postThreadQueryKey(postId);
      await queryClient.cancelQueries({ queryKey: threadKey });
      const previous = queryClient.getQueryData<{ post: Post; comments: Comment[] }>(threadKey);
      if (previous) {
        queryClient.setQueryData(threadKey, {
          ...previous,
          comments: previous.comments.map((c) =>
            c.id === commentId
              ? { ...c, score: c.score + (direction === "up" ? 1 : -1) }
              : c,
          ),
        });
      }
      return { previous, commentId };
    },
    // eslint-disable-next-line max-params
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(postThreadQueryKey(postId), context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: postThreadQueryKey(postId) });
    },
  });
}
