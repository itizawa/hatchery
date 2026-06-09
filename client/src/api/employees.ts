import type { Employee } from "@hatchery/common";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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

/**
 * PATCH /api/employees/:id を openApiClient 経由で呼ぶ mutation（#181）。
 * admin ロールのみ更新可（ADR-0018/0020）。
 * 成功後に Bot Employee 一覧を invalidate して最新データを反映する。
 */
export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: { displayName?: string; role?: string; personality?: string };
    }) => {
      const { data, response } = await openApiClient.PATCH("/api/employees/{id}", {
        params: { path: { id } },
        body,
        credentials: "include",
      });
      if (!response.ok || !data) {
        throw new Error(`PATCH /api/employees/${id} failed: ${response.status}`);
      }
      return data as unknown as Employee;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BOT_EMPLOYEES_QUERY_KEY }),
  });
}
