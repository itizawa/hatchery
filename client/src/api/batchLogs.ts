import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BatchRunLogSchema } from "@hatchery/common";
import type { BatchRunLog } from "@hatchery/common";

export const BATCH_LOGS_QUERY_KEY = ["admin", "batch-logs"] as const;

async function fetchBatchLogs(): Promise<BatchRunLog[]> {
  const res = await fetch("/admin/batch-logs", { credentials: "include" });
  if (!res.ok) throw new Error(`GET /admin/batch-logs failed: ${res.status}`);
  const data: unknown = await res.json();
  return BatchRunLogSchema.array().parse(data);
}

export function useBatchLogs() {
  return useQuery({
    queryKey: BATCH_LOGS_QUERY_KEY,
    queryFn: fetchBatchLogs,
  });
}

export function useRefreshBatchLogs() {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: BATCH_LOGS_QUERY_KEY }),
    [queryClient],
  );
}
