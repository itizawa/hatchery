import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { BatchRunLog } from "@hatchery/common";

export const BATCH_LOGS_QUERY_KEY = ["admin", "batch-logs"] as const;

async function fetchBatchLogs(): Promise<BatchRunLog[]> {
  const res = await fetch("/admin/batch-logs", { credentials: "include" });
  if (!res.ok) throw new Error(`GET /admin/batch-logs failed: ${res.status}`);
  return res.json() as Promise<BatchRunLog[]>;
}

export function useBatchLogs() {
  return useQuery({
    queryKey: BATCH_LOGS_QUERY_KEY,
    queryFn: fetchBatchLogs,
  });
}

export function useRefreshBatchLogs() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: BATCH_LOGS_QUERY_KEY });
}
