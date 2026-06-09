/**
 * コミュニティ API クライアント（#310）。
 * admin が community を作成・編集・一覧取得する API を openApiClient 経由で呼び出す。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CommunitySchema } from "@hatchery/common";
import type { Community, CreateCommunityInput, UpdateCommunityInput } from "@hatchery/common";

import { openApiClient } from "./client.js";

export const COMMUNITIES_QUERY_KEY = ["admin", "communities"] as const;

export type { Community };

/** GET /api/admin/communities — コミュニティ一覧を取得する（admin のみ）。 */
export async function fetchCommunities(): Promise<Community[]> {
  const { data, error, response } = await openApiClient.GET("/api/admin/communities", {
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

/** POST /api/admin/communities — コミュニティを作成する（admin のみ）。 */
export async function createCommunity(input: CreateCommunityInput): Promise<Community> {
  const { data, error, response } = await openApiClient.POST("/api/admin/communities", {
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

/** PATCH /api/admin/communities/:id — コミュニティを更新する（admin のみ）。 */
export async function updateCommunity(
  id: string,
  input: UpdateCommunityInput,
): Promise<Community> {
  const { data, error, response } = await openApiClient.PATCH("/api/admin/communities/{id}", {
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

export function useCommunities() {
  return useQuery({
    queryKey: COMMUNITIES_QUERY_KEY,
    queryFn: fetchCommunities,
  });
}

export function useCreateCommunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCommunity,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMMUNITIES_QUERY_KEY }),
  });
}

export function useUpdateCommunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCommunityInput }) =>
      updateCommunity(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMMUNITIES_QUERY_KEY }),
  });
}
