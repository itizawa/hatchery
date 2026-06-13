/**
 * ワーカーの参加コミュニティ編集 API クライアント（#490）。
 * - GET  /api/admin/workers/:id/communities … 参加コミュニティ id 一覧
 * - PUT  /api/admin/workers/:id/communities … 参加コミュニティを置き換える（set）
 *
 * admin 限定。型安全な openApiClient（ADR-0006）経由で呼ぶ。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { openApiClient } from "./client.js";
import { BOT_WORKERS_QUERY_KEY } from "./workers.js";
import { ADMIN_WORKERS_QUERY_KEY } from "./admin.js";

/** 指定ワーカーの参加コミュニティクエリのキャッシュキー（#490）。 */
export const workerCommunitiesQueryKey = (workerId: string) =>
  ["admin", "workers", workerId, "communities"] as const;

/** GET /api/admin/workers/:id/communities — 参加コミュニティ id 一覧を取得する。 */
export async function fetchWorkerCommunities(workerId: string): Promise<string[]> {
  const { data, error, response } = await openApiClient.GET(
    "/api/admin/workers/{id}/communities",
    {
      params: { path: { id: workerId } },
      credentials: "include",
    },
  );
  if (error || !response.ok || !data)
    throw new Error(`GET /api/admin/workers/${workerId}/communities failed: ${response.status}`);
  return data.communityIds;
}

/** PUT /api/admin/workers/:id/communities — 参加コミュニティを communityIds で置き換える。 */
export async function setWorkerCommunities(
  workerId: string,
  communityIds: string[],
): Promise<string[]> {
  const { data, error, response } = await openApiClient.PUT(
    "/api/admin/workers/{id}/communities",
    {
      params: { path: { id: workerId } },
      body: { communityIds },
      credentials: "include",
    },
  );
  if (error || !response.ok || !data)
    throw new Error(`PUT /api/admin/workers/${workerId}/communities failed: ${response.status}`);
  return data.communityIds;
}

/**
 * 指定ワーカーの参加コミュニティ id を TanStack Query で取得するフック（#490）。
 * workerId が空のときはクエリを無効化する（新規作成ダイアログで id 未確定のケース）。
 */
export function useWorkerCommunities(workerId: string) {
  return useQuery({
    queryKey: workerCommunitiesQueryKey(workerId),
    queryFn: () => fetchWorkerCommunities(workerId),
    enabled: workerId.length > 0,
  });
}

/**
 * 参加コミュニティを置き換えるミューテーションフック（#490）。
 * 成功時に該当ワーカーの communities クエリと Worker 一覧キャッシュを無効化して反映する。
 */
export function useSetWorkerCommunities() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workerId, communityIds }: { workerId: string; communityIds: string[] }) =>
      setWorkerCommunities(workerId, communityIds),
    onSuccess: (_data, { workerId }) => {
      void queryClient.invalidateQueries({ queryKey: workerCommunitiesQueryKey(workerId) });
      void queryClient.invalidateQueries({ queryKey: ADMIN_WORKERS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: BOT_WORKERS_QUERY_KEY });
    },
  });
}
