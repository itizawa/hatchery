import type { BatchRunLogRecord } from "@hatchery/common";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { openApiClient } from "./client.js";

export const BATCH_LOGS_QUERY_KEY = ["batch-logs"] as const;

/**
 * GET /batch-logs を openapi-fetch（生成型）経由で取得するフック（ADR-0006 / #75）。
 * サーバ状態は TanStack Query に集約する（ADR-0003）。
 */
export function useBatchLogs() {
  return useQuery({
    queryKey: BATCH_LOGS_QUERY_KEY,
    queryFn: async (): Promise<BatchRunLogRecord[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (openApiClient as any).GET("/batch-logs", {
        credentials: "include",
      });
      if (error) throw new Error(JSON.stringify(error));
      return (data ?? []) as BatchRunLogRecord[];
    },
  });
}

export function useBatchLogsRefetch() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: BATCH_LOGS_QUERY_KEY });
}
