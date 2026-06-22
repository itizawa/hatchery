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

type HomeFeedPage = { posts: Post[]; nextCursor: string | null };
type HomeFeedData = { pages: HomeFeedPage[]; pageParams: unknown[] };

type VoteFields = { score: number; up_count: number; my_vote?: "up" | "down" | null };

/** score/up_count/my_vote を toggle off / switch を考慮して楽観更新した値を返す（post / comment 共通）。 */
function calcOptimisticPostVote({
  post,
  direction,
}: {
  post: VoteFields;
  direction: VoteDirection;
}): { score: number; up_count: number; my_vote: "up" | "down" | null } {
  const prevMyVote = post.my_vote ?? null;
  const newMyVote = prevMyVote === direction ? null : direction;
  const prevScoreVal = prevMyVote === "up" ? 1 : prevMyVote === "down" ? -1 : 0;
  const newScoreVal = newMyVote === "up" ? 1 : newMyVote === "down" ? -1 : 0;
  return {
    score: post.score + (newScoreVal - prevScoreVal),
    up_count: post.up_count + (newMyVote === "up" ? 1 : 0) - (prevMyVote === "up" ? 1 : 0),
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
        ...(communitySlug ? [queryClient.cancelQueries({ queryKey: communityFeedQueryKey(communitySlug) })] : []),
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
      const previousHomeFeedEntries = queryClient.getQueriesData<HomeFeedData>({ queryKey: homeFeedPrefix });
      for (const [queryKey, data] of previousHomeFeedEntries) {
        if (!data) continue;
        queryClient.setQueryData<HomeFeedData>(queryKey, {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            posts: page.posts.map((p) =>
              p.id === postId ? { ...p, ...calcOptimisticPostVote({ post: p, direction }) } : p,
            ),
          })),
        });
      }

      // コミュニティフィードキャッシュを楽観更新（#872）。
      const previousCommunityFeed = communitySlug
        ? queryClient.getQueryData<Post[]>(communityFeedQueryKey(communitySlug))
        : undefined;
      if (communitySlug && previousCommunityFeed) {
        queryClient.setQueryData<Post[]>(
          communityFeedQueryKey(communitySlug),
          previousCommunityFeed.map((p) =>
            p.id === postId ? { ...p, ...calcOptimisticPostVote({ post: p, direction }) } : p,
          ),
        );
      }

      return { previousThread, previousHomeFeedEntries, previousCommunityFeed, postId };
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
      if (communitySlug && context?.previousCommunityFeed !== undefined) {
        queryClient.setQueryData(communityFeedQueryKey(communitySlug), context.previousCommunityFeed);
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
          post: { ...currentThread.post, score: serverPost.score, up_count: serverPost.up_count, my_vote: serverPost.my_vote ?? null },
        });
      }

      // ホームフィードキャッシュをサーバ確定値で更新する（#872）。
      const homeFeedEntries = queryClient.getQueriesData<HomeFeedData>({ queryKey: homeFeedQueryKeyPrefix() });
      for (const [queryKey, data] of homeFeedEntries) {
        if (!data) continue;
        queryClient.setQueryData<HomeFeedData>(queryKey, {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            posts: page.posts.map((p) =>
              p.id === postId
                ? { ...p, score: serverPost.score, up_count: serverPost.up_count, my_vote: serverPost.my_vote ?? null }
                : p,
            ),
          })),
        });
      }

      // コミュニティフィードキャッシュをサーバ確定値で更新する（#872）。
      if (communitySlug) {
        const currentCommunityFeed = queryClient.getQueryData<Post[]>(communityFeedQueryKey(communitySlug));
        if (currentCommunityFeed) {
          queryClient.setQueryData<Post[]>(
            communityFeedQueryKey(communitySlug),
            currentCommunityFeed.map((p) =>
              p.id === postId
                ? { ...p, score: serverPost.score, up_count: serverPost.up_count, my_vote: serverPost.my_vote ?? null }
                : p,
            ),
          );
        }
      }
    },
    onSettled: () => {
      // postThreadQueryKey は onSuccess で確定値を直接書き込む（#853 / #872）。feed/community は invalidate を維持。
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
              ? { ...c, score: serverComment.score, up_count: serverComment.up_count, my_vote: serverComment.my_vote ?? null }
              : c,
          ),
        });
      }
    },
  });
}
