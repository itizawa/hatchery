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
import { openApiClient, unwrap } from "./client.js";
import { postThreadQueryKey, type Post, type Comment } from "./posts.js";
import { communityFeedQueryKeyPrefix, homeFeedQueryKeyPrefix } from "./feed.js";

export type { VoteDirection };

/** localStorage に永続化するゲスト ID のキー（#777）。 */
const GUEST_ID_KEY = "hatchery:guestId";

/**
 * ゲスト用の永続化 UUID を取得または生成する（#777）。
 * localStorage に保存し、タブを閑じても同じ guestId が使われる。
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
  const result = await openApiClient.POST("/api/posts/{postId}/vote", {
    params: { path: { postId } },
    body: { direction, sessionId },
    credentials: "include",
  });
  return unwrap({ result, label: `POST /api/posts/${postId}/vote` });
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
  const result = await openApiClient.POST("/api/comments/{commentId}/vote", {
    params: { path: { commentId } },
    body: { direction, sessionId },
    credentials: "include",
  });
  return unwrap({ result, label: `POST /api/comments/${commentId}/vote` });
}

type FeedPage = { posts: Post[]; nextCursor: string | null };
type InfiniteFeedData = { pages: FeedPage[]; pageParams: unknown[] };

type VoteFields = { score: number; my_vote?: "up" | "down" | null };

/** score/my_vote を toggle off / switch を考慮して楽観更新した値を返す（post / comment 共通）。 */
function calcOptimisticPostVote({
  post,
  direction,
}: {
  post: VoteFields;
  direction: VoteDirection;
}): { score: number; my_vote: "up" | "down" | null } {
  const prevMyVote = post.my_vote ?? null;
  const newMyVote = prevMyVote === direction ? null : direction;
  const prevScoreVal = prevMyVote === "up" ? 1 : prevMyVote === "down" ? -1 : 0;
  const newScoreVal = newMyVote === "up" ? 1 : newMyVote === "down" ? -1 : 0;
  return {
    score: post.score + (newScoreVal - prevScoreVal),
    my_vote: newMyVote,
  };
}

/** post への vote ミューテーションフック。楽観更新 + キャッシュ無効化（ADR-0025 / #777 / #872）。 */
export function useVotePost(communitySlug?: string) {
  const queryClient = useQueryClient();
  const { data: authUser } = useAuth();
  // ログイン済みは userId、ゲストは localStorage guestId を sessionId として使う（#777）。
  const sessionId = authUser?.id ?? getOrCreateGuestId();

  return useMutation({
    mutationFn: ({ postId, direction }: { postId: string; direction: VoteDirection }) =>
      votePost({ postId, direction, sessionId }),
    onMutate: async ({ postId, direction }: { postId: string; direction: VoteDirection }) => {
      const threadKey = postThreadQueryKey(postId);
      const homeFeedPrefix = homeFeedQueryKeyPrefix();
      await Promise.all([
        queryClient.cancelQueries({ queryKey: threadKey }),
        queryClient.cancelQueries({ queryKey: homeFeedPrefix }),
        ...(communitySlug ? [queryClient.cancelQueries({ queryKey: communityFeedQueryKeyPrefix(communitySlug) })] : []),
      ]);

      // スレッドキャッシュを楽観更新（#814 / #831）。
      const previousThread = queryClient.getQueryData<{ post: Post; comments: Comment[] }>(threadKey);
      if (previousThread) {
        const optimistic = calcOptimisticPostVote({ post: previousThread.post, direction });
        queryClient.setQueryData(threadKey, {
          ...previousThread,
          post: { ...previousThread.post, ...optimistic },
        });
      }

      // ホームフィードキャッシュを楽観更新（#872）。全 sort キーを一括更新。
      const previousHomeFeedEntries = queryClient.getQueriesData<InfiniteFeedData>({ queryKey: homeFeedPrefix });
      for (const [queryKey, data] of previousHomeFeedEntries) {
        if (!data) continue;
        queryClient.setQueryData<InfiniteFeedData>(queryKey, {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            posts: page.posts.map((p) =>
              p.id === postId ? { ...p, ...calcOptimisticPostVote({ post: p, direction }) } : p,
            ),
          })),
        });
      }

      // コミュニティフィードキャッシュを楽観更新（#872 / #881 / #886 全 sort 対応）。
      const previousCommunityFeedEntries = communitySlug
        ? queryClient.getQueriesData<InfiniteFeedData>({ queryKey: communityFeedQueryKeyPrefix(communitySlug) })
        : [];
      for (const [queryKey, data] of previousCommunityFeedEntries) {
        if (!data) continue;
        queryClient.setQueryData<InfiniteFeedData>(queryKey, {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            posts: page.posts.map((p) =>
              p.id === postId ? { ...p, ...calcOptimisticPostVote({ post: p, direction }) } : p,
            ),
          })),
        });
      }

      return { previousThread, previousHomeFeedEntries, previousCommunityFeedEntries, postId };
    },
    // eslint-disable-next-line max-params
    onError: (_err, { postId }, context) => {
      if (context?.previousThread) {
        queryClient.setQueryData(postThreadQueryKey(postId), context.previousThread);
      }
      if (context?.previousHomeFeedEntries) {
        for (const [queryKey, data] of context.previousHomeFeedEntries) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousCommunityFeedEntries) {
        for (const [queryKey, data] of context.previousCommunityFeedEntries) {
          if (!data) continue;
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    // eslint-disable-next-line max-params
    onSuccess: (serverPost, { postId }) => {
      // スレッドキャッシュをサーバ確定値で更新する（#853）。
      const threadKey = postThreadQueryKey(postId);
      const currentThread = queryClient.getQueryData<{ post: Post; comments: Comment[] }>(threadKey);
      if (currentThread) {
        queryClient.setQueryData(threadKey, {
          ...currentThread,
          post: { ...currentThread.post, score: serverPost.score, my_vote: serverPost.my_vote ?? null },
        });
      }

      // ホームフィードキャッシュをサーバ確定値で更新する（#872）。
      const homeFeedEntries = queryClient.getQueriesData<InfiniteFeedData>({ queryKey: homeFeedQueryKeyPrefix() });
      for (const [queryKey, data] of homeFeedEntries) {
        if (!data) continue;
        queryClient.setQueryData<InfiniteFeedData>(queryKey, {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            posts: page.posts.map((p) =>
              p.id === postId
                ? { ...p, score: serverPost.score, my_vote: serverPost.my_vote ?? null }
                : p,
            ),
          })),
        });
      }

      // コミュニティフィードキャッシュをサーバ確定値で更新する（#872 / #881 / #886 全 sort 対応）。
      if (communitySlug) {
        const communityFeedEntries = queryClient.getQueriesData<InfiniteFeedData>({
          queryKey: communityFeedQueryKeyPrefix(communitySlug),
        });
        for (const [queryKey, data] of communityFeedEntries) {
          if (!data) continue;
          queryClient.setQueryData<InfiniteFeedData>(queryKey, {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              posts: page.posts.map((p) =>
                p.id === postId
                  ? { ...p, score: serverPost.score, my_vote: serverPost.my_vote ?? null }
                  : p,
              ),
            })),
          });
        }
      }
    },
    onSettled: () => {
      // postThreadQueryKey・homeFeed は onSuccess で確定値を直接書き込むため invalidate しない（#853 / #872）。
      if (communitySlug) {
        void queryClient.invalidateQueries({ queryKey: communityFeedQueryKeyPrefix(communitySlug) });
      }
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
      const threadKey = postThreadQueryKey(postId);
      await queryClient.cancelQueries({ queryKey: threadKey });
      const previous = queryClient.getQueryData<{ post: Post; comments: Comment[] }>(threadKey);
      if (previous) {
        queryClient.setQueryData(threadKey, {
          ...previous,
          comments: previous.comments.map((c) => {
            if (c.id !== commentId) return c;
            return { ...c, ...calcOptimisticPostVote({ post: c, direction }) };
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
          comments: current.comments.map((c) =>
            c.id === commentId
              ? { ...c, score: serverComment.score, my_vote: serverComment.my_vote ?? null }
              : c,
          ),
        });
      }
    },
  });
}
