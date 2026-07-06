/**
 * ランキング画面右サイドバー用のトレンド Post/Comment API クライアント（#1065）。
 * - GET /api/ranking/trending … 直近7日間で評価（vote）を多く獲得した Post/Comment 一覧
 */
import { useSuspenseQuery } from "@tanstack/react-query";
import type { TrendingItem } from "@hatchery/common";

import { openApiClient, unwrap } from "./client.js";

export const TRENDING_ITEMS_QUERY_KEY = ["ranking", "trending"] as const;

/** サイドバーに表示するトレンドアイテムの取得件数（既定 10・サーバ既定と一致）。 */
const TRENDING_ITEMS_LIMIT = 10;

/** GET /api/ranking/trending — トレンド Post/Comment 一覧を取得する（認証不要）。 */
export async function fetchTrendingItems(): Promise<TrendingItem[]> {
  const result = await openApiClient.GET("/api/ranking/trending", {
    params: { query: { limit: TRENDING_ITEMS_LIMIT } },
  });
  const data = unwrap({ result, label: "GET /api/ranking/trending" });
  return (data.items ?? []) as TrendingItem[];
}

/**
 * トレンド Post/Comment 一覧を TanStack Query（Suspense）で取得するフック（#1065）。
 * ローディング/エラーは呼び出し元の QueryBoundary に委譲する。
 */
export function useTrendingItems() {
  return useSuspenseQuery({
    queryKey: TRENDING_ITEMS_QUERY_KEY,
    queryFn: fetchTrendingItems,
    staleTime: 60_000,
  });
}
