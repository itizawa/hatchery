import type { Employee } from "@hatchery/common";
import { useQuery } from "@tanstack/react-query";

import { openApiClient } from "./client.js";

export const BOT_EMPLOYEES_QUERY_KEY = ["employees", "bots"] as const;

/**
 * GET /api/employees を openapi-fetch 経由で取得するフック（ADR-0006）。
 * isBot=true の Employee 一覧を返す（#240・仮想オフィス用）。
 * useQuery（非 Suspense）を使い、呼び出し元でローディング・エラー状態を処理する。
 */
export function useBotEmployees() {
  return useQuery({
    queryKey: BOT_EMPLOYEES_QUERY_KEY,
    queryFn: async (): Promise<Employee[]> => {
      const { data, error } = await openApiClient.GET("/api/employees");
      if (error) throw new Error(JSON.stringify(error));
      return (data ?? []) as unknown as Employee[];
    },
  });
}
