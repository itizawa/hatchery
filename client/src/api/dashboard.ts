/**
 * サイト全体の定量サマリダッシュボード API クライアント（#1113）。
 * - GET /api/dashboard … コミュニティ数・ワーカー数・投稿数・コメント数・累計閲覧数・累計 vote 数・
 *   購読数のサイト全体サマリと、コミュニティ別内訳（view_count 降順）。認証不要。
 */
import { useSuspenseQuery } from "@tanstack/react-query";
import type { DashboardSummary } from "@hatchery/common";

import { openApiClient, unwrap } from "./client.js";

export const DASHBOARD_SUMMARY_QUERY_KEY = ["dashboard", "summary"] as const;

/** GET /api/dashboard — サイト全体の定量サマリを取得する（認証不要）。 */
export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const result = await openApiClient.GET("/api/dashboard");
  return unwrap({ result, label: "GET /api/dashboard" }) as DashboardSummary;
}

/**
 * サイト全体の定量サマリを TanStack Query（Suspense）で取得するフック（#1113）。
 * ローディング/エラーは呼び出し元の QueryBoundary に委譲する。ログイン有無に関わらず利用できる。
 */
export function useDashboardSummary() {
  return useSuspenseQuery({
    queryKey: DASHBOARD_SUMMARY_QUERY_KEY,
    queryFn: fetchDashboardSummary,
    staleTime: 60_000,
  });
}
