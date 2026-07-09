import { useSuspenseQuery } from "@tanstack/react-query";
import { CommunityEngagementSchema } from "@hatchery/common";
import type { CommunityEngagement } from "@hatchery/common";

import { openApiClient, unwrap } from "./client.js";

export const COMMUNITY_ENGAGEMENT_QUERY_KEY = ["admin", "community-engagement"] as const;

/** GET /api/admin/community-engagement を取得する（#761）。 */
export async function fetchCommunityEngagement(): Promise<CommunityEngagement> {
  const result = await openApiClient.GET("/api/admin/community-engagement", {
    credentials: "include",
  });
  const data = unwrap({ result, label: "GET /api/admin/community-engagement" });
  return CommunityEngagementSchema.parse(data);
}

/**
 * コミュニティ帰属シグナルを取得するフック（#761）。
 * useSuspenseQuery（#459/#463）。ローディング・エラーは呼び出し元の QueryBoundary に委譲する。
 */
export function useCommunityEngagement() {
  return useSuspenseQuery({
    queryKey: COMMUNITY_ENGAGEMENT_QUERY_KEY,
    queryFn: fetchCommunityEngagement,
  });
}
