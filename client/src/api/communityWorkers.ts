/**
 * コミュニティ起点の所属ワーカー編集 API クライアント（#1079）。
 * - GET  /api/admin/communities/:id/workers … 所属ワーカー一覧（id・displayName）
 * - PUT  /api/admin/communities/:id/workers … 所属ワーカーを置き換える（set）
 *
 * `workerCommunities.ts`（#490・ワーカー起点）の逆方向。admin 限定。
 * 型安全な openApiClient（ADR-0006）経由で呼ぶ。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { openApiClient, unwrap } from "./client.js";

/** コミュニティ所属ワーカーの表示用サマリ（GET/PUT レスポンス要素）。 */
export interface CommunityWorkerAssignment {
  id: string;
  displayName: string;
}

/**
 * 指定コミュニティの所属ワーカー編集クエリのキャッシュキー（#1079）。
 * 公開ロスター（`communities.ts` の `communityWorkersQueryKey`・#1078・slug キー・カーソルページネーション）
 * とは別物のため名前空間・キーの型（communityId）ともに独立させる。
 */
export const adminCommunityWorkersQueryKey = (communityId: string) =>
  ["admin", "communities", communityId, "workers"] as const;

/** GET /api/admin/communities/:id/workers — 所属ワーカー一覧を取得する。 */
export async function fetchCommunityWorkerAssignments(
  communityId: string,
): Promise<CommunityWorkerAssignment[]> {
  const result = await openApiClient.GET("/api/admin/communities/{id}/workers", {
    params: { path: { id: communityId } },
    credentials: "include",
  });
  const data = unwrap({ result, label: `GET /api/admin/communities/${communityId}/workers` });
  return data.workers;
}

/** PUT /api/admin/communities/:id/workers — 所属ワーカーを workerIds で置き換える。 */
export async function setCommunityWorkerAssignments({
  communityId,
  workerIds,
}: {
  communityId: string;
  workerIds: string[];
}): Promise<CommunityWorkerAssignment[]> {
  // 失敗時はサーバが返す { error } メッセージを Error に乗せ、無ければフォールバック文言を使う（#476）。
  const result = await openApiClient.PUT("/api/admin/communities/{id}/workers", {
    params: { path: { id: communityId } },
    body: { workerIds },
    credentials: "include",
  });
  const data = unwrap({ result, label: "所属ワーカーの更新に失敗しました" });
  return data.workers;
}

/**
 * 指定コミュニティの所属ワーカーを TanStack Query で取得するフック（#1079）。
 * communityId が空のときはクエリを無効化する。
 */
export function useCommunityWorkerAssignments(communityId: string) {
  return useQuery({
    queryKey: adminCommunityWorkersQueryKey(communityId),
    queryFn: () => fetchCommunityWorkerAssignments(communityId),
    enabled: communityId.length > 0,
  });
}

/**
 * 所属ワーカーを置き換えるミューテーションフック（#1079）。
 * 成功時に該当コミュニティの所属ワーカークエリを無効化して反映する。
 */
export function useSetCommunityWorkerAssignments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ communityId, workerIds }: { communityId: string; workerIds: string[] }) =>
      setCommunityWorkerAssignments({ communityId, workerIds }),
    // eslint-disable-next-line max-params
    onSuccess: (_data, { communityId }) => {
      void queryClient.invalidateQueries({ queryKey: adminCommunityWorkersQueryKey(communityId) });
    },
  });
}
