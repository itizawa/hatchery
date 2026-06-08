import type { Employee } from "@hatchery/common";
import { useSuspenseQuery } from "@tanstack/react-query";

import { openApiClient } from "./client.js";

export const BOT_EMPLOYEES_QUERY_KEY = ["employees", "bots"] as const;

/**
 * GET /api/employees を openapi-fetch 経由で取得するフック（ADR-0006）。
 * isBot=true の Employee 一覧を返す（#240・仮想オフィス用）。
 * Suspense 対応: ローディング中は Promise を throw し、data は常に Employee[]（undefined なし）。
 */
export function useBotEmployees() {
  return useSuspenseQuery({
    queryKey: BOT_EMPLOYEES_QUERY_KEY,
    queryFn: async (): Promise<Employee[]> => {
      const { data, error } = await openApiClient.GET("/api/employees");
      if (error) throw new Error(JSON.stringify(error));
      return (data ?? []) as unknown as Employee[];
    },
  });
}
