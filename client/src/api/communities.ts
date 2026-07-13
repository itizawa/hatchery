/**
 * コミュニティ API クライアント（#533 でドメイン別に分割）。
 * - 管理者向け CRUD（/api/admin/communities）: #310
 * - 公開コミュニティ一覧・最近のワーカー・画像アップロード（/api/communities 等）: #307 / #207 / #457
 *
 * post / vote / feed / subscription のクライアントは各ドメインモジュールに分割済み
 * （`posts.ts` / `votes.ts` / `feed.ts` / `subscriptions.ts`）。後方互換のため本ファイルから
 * 引き続き re-export する（既存 import 参照を壊さない・受け入れ条件 2）。
 */
import {
  useMutation,
  useQueryClient,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { AdminCommunitySchema } from "@hatchery/common";
import type {
  AdminCommunity,
  CreateCommunityInput,
  UpdateCommunityInput,
} from "@hatchery/common";

import { clientEnv } from "../config/env.js";
import { openApiClient, unwrap } from "./client.js";
import type { components } from "./openapi.gen.js";

// ─── 分割先ドメインモジュールの後方互換 re-export（#533）──────────────────────────────────────────────
// post / vote / feed / subscription のシンボルは各モジュールへ移設したが、外部からの
// import 参照を壊さないよう本ファイルから引き続き公開する。
export { fetchPostThread, usePostThread, postThreadQueryKey } from "./posts.js";
export type { Post, Comment } from "./posts.js";
export {
  fetchCommunityFeedPage,
  fetchHomeFeedPage,
  useInfiniteCommunityFeed,
  useInfiniteHomeFeed,
  communityFeedQueryKey,
  communityFeedQueryKeyPrefix,
  homeFeedQueryKeyPrefix,
  homeFeedQueryKey,
} from "./feed.js";
export {
  votePost,
  voteComment,
  useVotePost,
  useVoteComment,
  type VoteDirection,
} from "./votes.js";
export {
  subscribeCommunity,
  unsubscribeCommunity,
  fetchSubscriptionStatus,
  useSubscribe,
  useUnsubscribe,
  communitySubscriptionQueryKey,
} from "./subscriptions.js";

/** community 画像の種別（#457）。 */
export type CommunityImageKind = "icon" | "cover";

/** community icon/cover アップロードのレスポンス型（種別ごとにレスポンス形状が異なるため union・#1180）。 */
export type CommunityImageUploadResponse =
  | components["schemas"]["CommunityIconUploadResponse"]
  | components["schemas"]["CommunityCoverUploadResponse"];

// ─── 公開 API 向け型定義（openapi.gen.ts より）────────────────────────────────────────────────
export type Community = components["schemas"]["Community"];

/** コミュニティ所属ワーカーの型（#207 / #1028 / #1078）。`GET /api/communities/{slug}/workers` の items 要素。 */
export type CommunityWorker = components["schemas"]["Worker"];

// ─── 管理者 API 向け型 re-export（@hatchery/common より）──────────────────
export type { AdminCommunity, CreateCommunityInput, UpdateCommunityInput };

// ─── Query Keys ───────────────────────────────────────────────────────────────────────────
/** 管理者コミュニティ一覧（/api/admin/communities）のキャッシュキー。 */
export const ADMIN_COMMUNITIES_QUERY_KEY = ["admin", "communities"] as const;
/** 後方互換のエイリアス（CommunitiesTab.tsx など既存コードが参照）。 */
export const COMMUNITIES_QUERY_KEY = ADMIN_COMMUNITIES_QUERY_KEY;

export const communityWorkersQueryKey = (slug: string) =>
  ["communities", slug, "workers"] as const;

// ─── 管理者向け API 関数（/api/admin/communities）────────────────────────────────────────────────────

/** GET /api/admin/communities — コミュニティ一覧を取得する（admin のみ）。 */
export async function fetchAdminCommunities(): Promise<AdminCommunity[]> {
  const result = await openApiClient.GET("/api/admin/communities", {
    credentials: "include",
  });
  const data = unwrap({ result, label: "GET /api/admin/communities" });
  return AdminCommunitySchema.array().parse(
    data.map((c) => ({
      ...c,
      created_at: new Date(c.created_at),
    })),
  );
}

/** 後方互換: CommunitiesTab.tsx などが参照する fetchCommunities は管理者向けを指す。 */
export const fetchCommunities = fetchAdminCommunities;

/** POST /api/admin/communities — コミュニティを作成する（admin のみ）。 */
export async function createCommunity(input: CreateCommunityInput): Promise<AdminCommunity> {
  const result = await openApiClient.POST("/api/admin/communities", {
    body: input,
    credentials: "include",
  });
  const data = unwrap({ result, label: "POST /api/admin/communities" });
  return AdminCommunitySchema.parse({
    ...data,
    created_at: new Date(data.created_at),
  });
}

/** PATCH /api/admin/communities/:id — コミュニティを更新する（admin のみ）。 */
// eslint-disable-next-line max-params
export async function updateCommunity(
  id: string,
  input: UpdateCommunityInput,
): Promise<AdminCommunity> {
  const result = await openApiClient.PATCH("/api/admin/communities/{id}", {
    params: { path: { id } },
    body: input,
    credentials: "include",
  });
  const data = unwrap({ result, label: `PATCH /api/admin/communities/${id}` });
  return AdminCommunitySchema.parse({
    ...data,
    created_at: new Date(data.created_at),
  });
}

/**
 * 管理者コミュニティ一覧を TanStack Query（Suspense）で取得するフック（CommunitiesTab.tsx 向け）。
 * Suspense 化により data は non-undefined（#462）。ローディング/エラーは QueryBoundary に委譲する。
 */
export function useCommunities() {
  return useSuspenseQuery({
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

/**
 * POST /api/admin/communities/:id/{icon|cover} でコミュニティの画像をアップロードする（#457）。
 * admin ロール必須。multipart/form-data で `image` フィールドを送信する。
 * openapi-fetch は multipart/form-data 非対応のため worker 同様 fetch を直接呼ぶ。
 * baseUrl は clientEnv.apiBaseUrl（クロスオリジン配信 #78）→ window.location.origin の順で解決。
 */
// eslint-disable-next-line max-params
export async function uploadCommunityImage(
  communityId: string,
  kind: CommunityImageKind,
  file: File,
): Promise<CommunityImageUploadResponse> {
  const formData = new FormData();
  formData.append("image", file);

  const base =
    clientEnv.apiBaseUrl ?? (typeof window !== "undefined" ? window.location.origin : "");

  const res = await fetch(`${base}/api/admin/communities/${communityId}/${kind}`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Upload failed: ${res.status}`);
  }

  return res.json() as Promise<CommunityImageUploadResponse>;
}

/**
 * コミュニティ画像アップロードの useMutation フック（#457）。
 * 成功時に admin / 公開コミュニティ一覧を無効化して最新状態を反映する。
 */
export function useUploadCommunityImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      communityId,
      kind,
      file,
    }: {
      communityId: string;
      kind: CommunityImageKind;
      file: File;
    }) => uploadCommunityImage(communityId, kind, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_COMMUNITIES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
  });
}

// ─── 公開ブラウズ向け API 関数（/api/communities 等）────────────────────────────────────────────────────

/** GET /api/communities — 公開コミュニティ一覧を取得する（認証不要）。 */
export async function fetchPublicCommunities(): Promise<Community[]> {
  const result = await openApiClient.GET("/api/communities", {
    credentials: "include",
  });
  return unwrap({ result, label: "GET /api/communities" });
}

/**
 * GET /api/communities/{slug}/workers — community 所属の全ワーカーを 1 ページ分取得する（#1078 カーソルページネーション）。
 */
export async function fetchCommunityWorkersPage({
  slug,
  cursor,
  limit = 20,
}: {
  slug: string;
  cursor?: string;
  limit?: number;
}): Promise<{ items: CommunityWorker[]; nextCursor: string | null }> {
  const query: { cursor?: string; limit: number } = { limit };
  if (cursor) query.cursor = cursor;
  const result = await openApiClient.GET("/api/communities/{slug}/workers", {
    params: { path: { slug }, query },
    credentials: "include",
  });
  return unwrap({ result, label: `GET /api/communities/${slug}/workers` }) as {
    items: CommunityWorker[];
    nextCursor: string | null;
  };
}

/**
 * community 所属の全ワーカーを TanStack Query（Suspense）の無限スクロールで取得するフック（#1078 / #462）。
 * data は non-undefined。ローディング/エラーは QueryBoundary に委譲する。
 */
export function useCommunityWorkers(slug: string) {
  return useSuspenseInfiniteQuery({
    queryKey: communityWorkersQueryKey(slug),
    queryFn: ({ pageParam }) =>
      fetchCommunityWorkersPage({ slug, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 60_000,
    retry: false,
  });
}

/**
 * 公開コミュニティ一覧を TanStack Query（Suspense）で取得するフック（ブラウズ・サイドバー向け / #462）。
 * data は non-undefined。ローディング/エラーは QueryBoundary に委譲する。
 */
export function usePublicCommunities() {
  return useSuspenseQuery({
    queryKey: ["communities"],
    queryFn: fetchPublicCommunities,
    staleTime: 60_000,
  });
}
