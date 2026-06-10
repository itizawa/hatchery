/**
 * コミュニティ API クライアント。
 * - 管理者向け CRUD（/api/admin/communities）: #310
 * - 公開ブラウズ・フィード・投票・購読（/api/communities, /api/feed 等）: #307
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CommunitySchema } from "@hatchery/common";
import type {
  Community as AdminCommunity,
  CreateCommunityInput,
  UpdateCommunityInput,
} from "@hatchery/common";

import { openApiClient } from "./client.js";
import type { components } from "./openapi.gen.js";

// ─── 公開 API 向け型定義（openapi.gen.ts より）─────────────────────────────
export type Community = components["schemas"]["Community"];
export type Post = components["schemas"]["Post"];
export type Comment = components["schemas"]["Comment"];

// ─── 管理者 API 向け型 re-export（@hatchery/common より）──────────────────
export type { AdminCommunity, CreateCommunityInput, UpdateCommunityInput };

// ─── Query Keys ────────────────────────────────────────────────────────────
/** 管理者コミュニティ一覧（/api/admin/communities）のキャッシュキー。 */
export const ADMIN_COMMUNITIES_QUERY_KEY = ["admin", "communities"] as const;
/** 後方互換のエイリアス（CommunitiesTab.tsx など既存コードが参照）。 */
export const COMMUNITIES_QUERY_KEY = ADMIN_COMMUNITIES_QUERY_KEY;

export const communityFeedQueryKey = (slug: string) => ["communities", slug, "feed"] as const;
export const homeFeedQueryKey = () => ["feed"] as const;
export const postThreadQueryKey = (postId: string) => ["posts", postId] as const;
export const communitySubscriptionQueryKey = (slug: string) =>
  ["communities", slug, "subscription"] as const;

// ─── 管理者向け API 関数（/api/admin/communities）─────────────────────────

/** GET /api/admin/communities — コミュニティ一覧を取得する（admin のみ）。
 * NOTE: このエンドポイントは openapi.gen.ts に未登録（#305 マージ待ち）のため as any で呼ぶ。
 */
export async function fetchAdminCommunities(): Promise<AdminCommunity[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error, response } = await (openApiClient as any).GET("/api/admin/communities", {
    credentials: "include",
  });
  if (error || !response.ok || !data)
    throw new Error(`GET /api/admin/communities failed: ${response.status}`);
  return CommunitySchema.array().parse(
    (data as Array<unknown>).map((c) => ({
      ...(c as object),
      created_at: new Date((c as { created_at: string }).created_at),
    })),
  );
}

/** 後方互換: CommunitiesTab.tsx などが参照する fetchCommunities は管理者向けを指す。 */
export const fetchCommunities = fetchAdminCommunities;

/** POST /api/admin/communities — コミュニティを作成する（admin のみ）。
 * NOTE: このエンドポイントは openapi.gen.ts に未登録（#305 マージ待ち）のため as any で呼ぶ。
 */
export async function createCommunity(input: CreateCommunityInput): Promise<AdminCommunity> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error, response } = await (openApiClient as any).POST("/api/admin/communities", {
    body: input,
    credentials: "include",
  });
  if (error || !response.ok || !data)
    throw new Error(`POST /api/admin/communities failed: ${response.status}`);
  return CommunitySchema.parse({
    ...(data as object),
    created_at: new Date((data as { created_at: string }).created_at),
  });
}

/** PATCH /api/admin/communities/:id — コミュニティを更新する（admin のみ）。
 * NOTE: このエンドポイントは openapi.gen.ts に未登録（#305 マージ待ち）のため as any で呼ぶ。
 */
export async function updateCommunity(
  id: string,
  input: UpdateCommunityInput,
): Promise<AdminCommunity> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error, response } = await (openApiClient as any).PATCH("/api/admin/communities/{id}", {
    params: { path: { id } },
    body: input,
    credentials: "include",
  });
  if (error || !response.ok || !data)
    throw new Error(`PATCH /api/admin/communities/${id} failed: ${response.status}`);
  return CommunitySchema.parse({
    ...(data as object),
    created_at: new Date((data as { created_at: string }).created_at),
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

// ─── 公開ブラウズ向け API 関数（/api/communities, /api/feed 等）─────────────

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
 * GET /api/feed — ホームフィードを取得する（認証必須）。
 */
export async function fetchHomeFeed(): Promise<Post[]> {
  const { data, response } = await openApiClient.GET("/api/feed", {
    credentials: "include",
  });
  if (!response.ok || !data) throw new Error(`GET /api/feed failed: ${response.status}`);
  return data;
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
 * POST /api/posts/{postId}/vote — post に up vote する。
 */
export async function votePost(postId: string): Promise<Post> {
  const { data, response } = await openApiClient.POST("/api/posts/{postId}/vote", {
    params: { path: { postId } },
    credentials: "include",
  });
  if (!response.ok || !data)
    throw new Error(`POST /api/posts/${postId}/vote failed: ${response.status}`);
  return data;
}

/**
 * POST /api/comments/{commentId}/vote — comment に up vote する。
 */
export async function voteComment(commentId: string): Promise<Comment> {
  const { data, response } = await openApiClient.POST("/api/comments/{commentId}/vote", {
    params: { path: { commentId } },
    credentials: "include",
  });
  if (!response.ok || !data)
    throw new Error(`POST /api/comments/${commentId}/vote failed: ${response.status}`);
  return data;
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

/** ホームフィードを TanStack Query で取得するフック（認証必須）。未認証時は enabled: false を渡してコールを抑制できる。 */
export function useHomeFeed(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: homeFeedQueryKey(),
    queryFn: fetchHomeFeed,
    staleTime: 30_000,
    retry: false,
    enabled: options?.enabled,
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

/** post への up vote ミューテーションフック。楽観更新（score 即時インクリメント）+ キャッシュ無効化。 */
export function useVotePost(communitySlug?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => votePost(postId),
    onMutate: async (postId: string) => {
      // 楽観更新: スレッドキャッシュの score を +1
      const threadKey = postThreadQueryKey(postId);
      await queryClient.cancelQueries({ queryKey: threadKey });
      const previous = queryClient.getQueryData<{ post: Post; comments: Comment[] }>(threadKey);
      if (previous) {
        queryClient.setQueryData(threadKey, {
          ...previous,
          post: { ...previous.post, score: previous.post.score + 1 },
        });
      }
      return { previous, postId };
    },
    onError: (_err, postId, context) => {
      // ロールバック
      if (context?.previous) {
        queryClient.setQueryData(postThreadQueryKey(postId), context.previous);
      }
    },
    onSettled: (_data, _err, postId) => {
      void queryClient.invalidateQueries({ queryKey: postThreadQueryKey(postId) });
      if (communitySlug) {
        void queryClient.invalidateQueries({ queryKey: communityFeedQueryKey(communitySlug) });
      }
      void queryClient.invalidateQueries({ queryKey: homeFeedQueryKey() });
    },
  });
}

/** comment への up vote ミューテーションフック。楽観更新（score 即時インクリメント）+ キャッシュ無効化。 */
export function useVoteComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => voteComment(commentId),
    onMutate: async (commentId: string) => {
      // 楽観更新: スレッドキャッシュのコメント score を +1
      const threadKey = postThreadQueryKey(postId);
      await queryClient.cancelQueries({ queryKey: threadKey });
      const previous = queryClient.getQueryData<{ post: Post; comments: Comment[] }>(threadKey);
      if (previous) {
        queryClient.setQueryData(threadKey, {
          ...previous,
          comments: previous.comments.map((c) =>
            c.id === commentId ? { ...c, score: c.score + 1 } : c,
          ),
        });
      }
      return { previous, commentId };
    },
    onError: (_err, _commentId, context) => {
      // ロールバック
      if (context?.previous) {
        queryClient.setQueryData(postThreadQueryKey(postId), context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: postThreadQueryKey(postId) });
    },
  });
}
