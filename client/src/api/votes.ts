/**
 * 投票 API クライアント（ADR-0025 / #533 / #777: ゲスト対応）。
 * - POST /api/posts/{postId}/vote … post への up/down vote
 * - POST /api/comments/{commentId}/vote … comment への up/down vote
 * 楽観更新 + キャッシュ無効化フックを提供する。
 * #777: ゲスト（未認証）も vote できるよう sessionId を dedup キーとして送信する。
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { VoteDirection } from "@hatchery/common";

import { useAuth } from "./auth.js";
import { openApiClient } from "./client.js";
import { postThreadQueryKey, type Post, type Comment } from "./posts.js";
import { communityFeedQueryKey, homeFeedQueryKeyPrefix } from "./feed.js";

export type { VoteDirection };

/** localStorage に永続化するゲスト ID のキー（#777）。 */
const GUEST_ID_KEY = "hatchery:guestId";

/**
 * ゲスト用の永続化 UUID を取得または生成する（#777）。
 * localStorage に保存し、タブを閉じても同じ guestId が使われる。
 * localStorage が使えない環境（プライベートモード等）では都度生成する（toggle/switch は機能しない）。
 */
export function getOrCreateGuestId(): string {
  try {
    const stored = localStorage.getItem(GUEST_ID_KEY);
    if (stored) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem(GUEST_ID_KEY, id);
    return id;
  } catch {
    // localStorage 利用不可の場合は都度生成する。
    return crypto.randomUUID();
  }
}

/**
 * POST /api/posts/{postId}/vote — post に up/down vote する（ADR-0025 / #777）。
 * sessionId: ログイン済みは userId、ゲストは guestId を送る。
 */
export async function votePost({
  postId,
  direction,
  sessionId,
}: {
  postId: string;
  direction: VoteDirection;
  sessionId: string;
}): Promise<Post> {
  const { data, response } = await openApiClient.POST("/api/posts/{postId}/vote", {
    params: { path: { postId } },
    body: { direction, sessionId },
    credentials: "include",
  });
  if (!response.ok || !data)
    throw new Error(`POST /api/posts/${postId}/vote failed: ${response.status}`);
  return data;
}

/**
 * POST /api/comments/{commentId}/vote — comment に up/down vote する（ADR-0025 / #777）。
 * sessionId: ログイン済みは userId、ゲストは guestId を送る。
 */
export async function voteComment({
  commentId,
  direction,
  sessionId,
}: {
  commentId: string;
  direction: VoteDirection;
  sessionId: string;
}): Promise<Comment> {
  const { data, response } = await openApiClient.POST("/api/comments/{commentId}/vote", {
    params: { path: { commentId } },
    body: { direction, sessionId },
    credentials: "include",
  });
  if (!response.ok || !data)
    throw new Error(`POST /api/comments/${commentId}/vote failed: ${response.status}`);
  return data;
}

/** post への vote ミューテーションフック。楽観更新 + キャッシュ無効化（ADR-0025 / #777）。 */
export function useVotePost(communitySlug?: string) {
  const queryClient = useQueryClient();
  const { data: authUser } = useAuth();
  // ログイン済みは userId、ゲストは localStorage guestId を sessionId として使う（#777）。
  const sessionId = authUser?.id ?? getOrCreateGuestId();

  return useMutation({
    mutationFn: ({ postId, direction }: { postId: string; direction: VoteDirection }) =>
      votePost({ postId, direction, sessionId }),
    onMutate: async ({ postId, direction }: { postId: string; direction: VoteDirection }) => {
      // 楽観更新: スレッドキャッシュの score / up_count / my_vote を更新（#814 / #831）。
      // up_count は up 押下で +1、down 押下で変化なし（0）とする近似値。
      // 正確な値は onSettled の invalidate 後にサーバ応答で修正される。
      const threadKey = postThreadQueryKey(postId);
      await queryClient.cancelQueries({ queryKey: threadKey });
      const previous = queryClient.getQueryData<{ post: Post; comments: Comment[] }>(threadKey);
      if (previous) {
        // toggle off: 同じ方向を再度押したらニュートラル（null）に戻す（#831）。
        const prevMyVote = previous.post.my_vote ?? null;
        const newMyVote = prevMyVote === direction ? null : direction;
        // score / up_count は prevMyVote → newMyVote の遷移から正確に算出する（#831 レビュー指摘）。
        const prevScoreVal = prevMyVote === "up" ? 1 : prevMyVote === "down" ? -1 : 0;
        const newScoreVal = newMyVote === "up" ? 1 : newMyVote === "down" ? -1 : 0;
        queryClient.setQueryData(threadKey, {
          ...previous,
          post: {
            ...previous.post,
            score: previous.post.score + (newScoreVal - prevScoreVal),
            up_count: previous.post.up_count + (newMyVote === "up" ? 1 : 0) - (prevMyVote === "up" ? 1 : 0),
            my_vote: newMyVote,
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
    onSuccess: (serverPost, { postId }) => {
      // POST vote レスポンス（my_vote 込みの確定値）でスレッドキャッシュを更新する（#853）。
      const threadKey = postThreadQueryKey(postId);
      const current = queryClient.getQueryData<{ post: Post; comments: Comment[] }>(threadKey);
      if (current) {
        queryClient.setQueryData(threadKey, { ...current, post: { ...current.post, ...serverPost } });
      }
    },
    onSettled: () => {
      // postThreadQueryKey は onSuccess で確定値を直接書き込む（#853）。feed/community は invalidate を維持。
      if (communitySlug) {
        void queryClient.invalidateQueries({ queryKey: communityFeedQueryKey(communitySlug) });
      }
      void queryClient.invalidateQueries({ queryKey: homeFeedQueryKeyPrefix() });
    },
  });
}

/** comment への vote ミューテーションフック。楽観更新 + キャッシュ無効化（ADR-0025 / #777）。 */
export function useVoteComment(postId: string) {
  const queryClient = useQueryClient();
  const { data: authUser } = useAuth();
  // ログイン済みは userId、ゲストは localStorage guestId を sessionId として使う（#777）。
  const sessionId = authUser?.id ?? getOrCreateGuestId();

  return useMutation({
    mutationFn: ({
      commentId,
      direction,
    }: {
      commentId: string;
      direction: VoteDirection;
    }) => voteComment({ commentId, direction, sessionId }),
    onMutate: async ({
      commentId,
      direction,
    }: {
      commentId: string;
      direction: VoteDirection;
    }) => {
      // 楽観更新: スレッドキャッシュのコメント score / up_count / my_vote を更新（#814 / #831）。
      // up_count は up 押下で +1、down 押下で変化なし（0）とする近似値。
      const threadKey = postThreadQueryKey(postId);
      await queryClient.cancelQueries({ queryKey: threadKey });
      const previous = queryClient.getQueryData<{ post: Post; comments: Comment[] }>(threadKey);
      if (previous) {
        queryClient.setQueryData(threadKey, {
          ...previous,
          comments: previous.comments.map((c) => {
            if (c.id !== commentId) return c;
            // toggle off: 同じ方向を再度押したらニュートラル（null）に戻す（#831）。
            const prevMyVote = c.my_vote ?? null;
            const newMyVote = prevMyVote === direction ? null : direction;
            // score / up_count は prevMyVote → newMyVote の遷移から正確に算出する（#831 レビュー指摘）。
            const prevScoreVal = prevMyVote === "up" ? 1 : prevMyVote === "down" ? -1 : 0;
            const newScoreVal = newMyVote === "up" ? 1 : newMyVote === "down" ? -1 : 0;
            return {
              ...c,
              score: c.score + (newScoreVal - prevScoreVal),
              up_count: c.up_count + (newMyVote === "up" ? 1 : 0) - (prevMyVote === "up" ? 1 : 0),
              my_vote: newMyVote,
            };
          }),
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
    // eslint-disable-next-line max-params
    onSuccess: (serverComment, { commentId }) => {
      // POST vote レスポンス（my_vote 込みの確定値）でスレッドキャッシュのコメントを更新する（#853）。
      const threadKey = postThreadQueryKey(postId);
      const current = queryClient.getQueryData<{ post: Post; comments: Comment[] }>(threadKey);
      if (current) {
        queryClient.setQueryData(threadKey, {
          ...current,
          comments: current.comments.map((c) => c.id === commentId ? { ...c, ...serverComment } : c),
        });
      }
    },
  });
}
