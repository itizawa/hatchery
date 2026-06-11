/**
 * コミュニティ API クライアント。
 * - 管理者向け CRUD（/api/admin/communities）: #310
 * - 公開ブラウズ・フィード・投票・購読（/api/communities, /api/feed 等）: #307
 */
import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { CommunitySchema } from "@hatchery/common";
import type {
  Community as AdminCommunity,
  CreateCommunityInput,
  UpdateCommunityInput,
  VoteDirection,
} from "@hatchery/common";

export type { VoteDirection };

import { openApiClient } from "./client.js";
import type { components } from "./openapi.gen.js";

// ─── 公開 API 向け型定義（openapi.gen.ts より）───────────────────────────────────────────
export type Community = components["schemas"]["Community"];
export type Post = components["schemas"]["Post"];
export type Comment = components["schemas"]["Comment"];

/** 最近投稿したワーカーの表示用最小型（#207）。`GET /api/communities/{slug}/recent-workers` の戻り値。 */
export type RecentWorker = {
  id: string;
  displayName: string;
  role?: string | null;
  imageUrl?: string | null;
};

// ─── 管理者 API 向け型 re-export（@hatchery/common より）────────────────────────
export type { AdminCommunity, CreateCommunityInput, UpdateCommunityInput };

// ─── Query Keys ───────────────────────────────────────────────────────────────────
/** 管理者コミュニティ一覧（/api/admin/communities）のキャッシュキー。 */
export const ADMIN_COMMUNITIES_QUERY_KEY = ["admin", "communities"] as const;
/** 後方互换のエイリアス（CommunitiesTab.tsx など既存コードが参照）。 */
export const COMMUNITIES_QUERY_KEY = ADMIN_COMMUNITIES_QUERY_KEY;

export const communityFeedQueryKey = (slug: string) => ["communities", slug, "feed"] as const;
export const communityRecentWorkersQueryKey = (slug: string) =>
  ["communities", slug, "recent-workers"] as const;
export const homeFeedQueryKey = () => ["feed"] as const;
export const postThreadQueryKey = (postId: string) => ["posts", postId] as const;
export const communitySubscriptionQueryKey = (slug: string) =>
  ["communities", slug, "subscription"] as const;

// ─── 管理者向け API 関数（/api/admin/communities）───────────────────────────────────────

/** GET /api/admin/communities — コミュニティ一覧を取得する（admin のみ）。 */
export async function fetchAdminCommunities(): Promise<AdminCommunity[]> {
  const { data, error, response } = await openApiClient.GET("/api/admin/communities", {
    credentials: "include",
  });
  if (error || !response.ok || !data)
    throw new Error(`GET /api/admin/communities failed: ${response.status}`);
  return CommunitySchema.array().parse(
    data.map((c) => ({
      ...c,
      created_at: new Date(c.created_at),
    })),
  );
}

/** 後方互换: CommunitiesTab.tsx などが参照する fetchCommunities は管理者向けを指す。 */
export const fetchCommunities = fetchAdminCommunities;

/** POST /api/admin/communities — コミュニティを作成する（admin のみ）。 */
export async function createCommunity(input: CreateCommunityInput): Promise<AdminCommunity> {
  const { data, error, response } = await openApiClient.POST("/api/admin/communities", {
    body: input,
    credentials: "include",
  });
  if (error || !response.ok || !data)
    throw new Error(`POST /api/admin/communities failed: ${response.status}`);
  return CommunitySchema.parse({
    ...data,
    created_at: new Date(data.created_at),
  });
}

/** PATCH /api/admin/communities/:id — コミュニティを更新する（admin のみ）。 */
export async function updateCommunity(
  id: string,
  input: UpdateCommunityInput,
): Promise<AdminCommunity> {
  const { data, error, response } = await openApiClient.PATCH("/api/admin/communities/{id}", {
    params: { path: { id } },
    body: input,
    credentials: "include",
  });
  if (error || !response.ok || !data)
    throw new Error(`PATCH /api/admin/communities/${id} failed: ${response.status}`);
  return CommunitySchema.parse({
    ...data,
    created_at: new Date(data.created_at),
  });
}

/** 管理者コミュニティ一覧を TanStack Query で取得するフック（CommunitiesTab.tsx 向け）。 */
export function useCommunities() {
  return useQuery({
    queryKey: ADMIN_COMMUNITIES_QUERY_KEY,
    queryFn: fetchAdminCommunities,
  });
}

export function useCreateCommunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCommunity,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_COMMUNITIES_QUERY_KEY }),
  });
}

export function useUpdateCommunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCommunityInput }) =>
      updateCommunity(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_COMMUNITIES_QUERY_KEY }),
  });
}

// ─── 公開ブラウズ向け API 関数（/api/communities, /api/feed 等）──────────────────────────

/** GET /api/communities — 公開コミュニティ一覧を取得する（認証不要）。 */
export async function fetchPublicCommunities(): Promise<Community[]> {
  const { data, response } = await openApiClient.GET("/api/communities", {
    credentials: "include",
  });
  if (!response.ok || !data) throw new Error(`GET /api/communities failed: ${response.status}`);
  return data;
}

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
 * GET /api/feed — ホームフィードを 1 ページ分取得する（カーソルページネーション #367）。
 */
export async function fetchHomeFeedPage(
  cursor?: string,
): Promise<{ posts: Post[]; nextCursor: string | null }> {
  const { data, response } = await openApiClient.GET("/api/feed", {
    params: { query: cursor ? { cursor, limit: 20 } : { limit: 20 } },
    credentials: "include",
  });
  if (!response.ok || !data) throw new Error(`GET /api/feed failed: ${response.status}`);
  return data as { posts: Post[]; nextCursor: string | null };
}

/**
 * GET /api/posts/{postId} — スレッド（post + comments）を取得する。
 */
export async function fetchPostThread(
  postId: string,
): Promise<{ post: Post; comments: Comment[] }> {
  const { data, response } = await openApiClient.GET("/api/posts/{postId}", {
    params: { path: { postId } },
    credentials: "include",
  });
  if (!response.ok || !data)
    throw new Error(`GET /api/posts/${postId} failed: ${response.status}`);
  return data;
}

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
 * POST /api/posts/{postId}/vote — post に up/down vote する（ADR-0025）。
 */
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

/**
 * GET /api/communities/{slug}/recent-workers — community の最近投稿したワーカー一覧を取得（#207）。
 * openapi.gen.ts はビルド時に生成されるためコミット対象外。CI パイプラインで再生成後に
 * openApiClient.GET に移行すること（#372 型整合修正と合わせて対応予定）。
 */
export async function fetchRecentWorkers(slug: string): Promise<RecentWorker[]> {
  const res = await fetch(`/api/communities/${encodeURIComponent(slug)}/recent-workers`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`GET /api/communities/${slug}/recent-workers failed: ${res.status}`);
  return res.json() as Promise<RecentWorker[]>;
}

/** community の最近投稿したワーカー一覧を TanStack Query で取得するフック（#207）。 */
export function useRecentWorkers(slug: string) {
  return useQuery({
    queryKey: communityRecentWorkersQueryKey(slug),
    queryFn: () => fetchRecentWorkers(slug),
    staleTime: 60_000,
  });
}

/** 公開コミュニティ一覧を TanStack Query で取得するフック（ブラウズ・サイドバー向け）。 */
export function usePublicCommunities() {
  return useQuery({
    queryKey: ["communities"],
    queryFn: fetchPublicCommunities,
    staleTime: 60_000,
  });
}

/** コミュニティフィードを TanStack Query で取得するフック。 */
export function useCommunityFeed(slug: string) {
  return useQuery({
    queryKey: communityFeedQueryKey(slug),
    queryFn: () => fetchCommunityFeed(slug),
    staleTime: 30_000,
  });
}

/** ホームフィードを TanStack Query の無限スクロールで取得するフック（#367）。 */
export function useInfiniteHomeFeed() {
  return useInfiniteQuery({
    queryKey: homeFeedQueryKey(),
    queryFn: ({ pageParam }) => fetchHomeFeedPage(pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
    retry: false,
  });
}

/** スレッド（post + comments）を TanStack Query で取得するフック。 */
export function usePostThread(postId: string) {
  return useQuery({
    queryKey: postThreadQueryKey(postId),
    queryFn: () => fetchPostThread(postId),
    staleTime: 30_000,
  });
}

/** コミュニティ購読ミューテーションフック。成功後に購読状態キャッシュを更新する。 */
export function useSubscribe(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => subscribeCommunity(slug),
    onSuccess: () => {
      // 購読状態を true に直接更新する（購読一覧 API がないため setQueryData を使用）
      queryClient.setQueryData(communitySubscriptionQueryKey(slug), true);
      void queryClient.invalidateQueries({ queryKey: homeFeedQueryKey() });
    },
  });
}

/** コミュニティ購読解除ミューテーションフック。成功後に購読状態キャッシュを更新する。 */
export function useUnsubscribe(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unsubscribeCommunity(slug),
    onSuccess: () => {
      // 購読状態を false に直接更新する
      queryClient.setQueryData(communitySubscriptionQueryKey(slug), false);
      void queryClient.invalidateQueries({ queryKey: homeFeedQueryKey() });
    },
  });
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
    onError: (_err, { postId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(postThreadQueryKey(postId), context.previous);
      }
    },
    onSettled: (_data, _err, { postId }) => {
      void queryClient.invalidateQueries({ queryKey: postThreadQueryKey(postId) });
      if (communitySlug) {
        void queryClient.invalidateQueries({ queryKey: communityFeedQueryKey(communitySlug) });
      }
      void queryClient.invalidateQueries({ queryKey: homeFeedQueryKey() });
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
