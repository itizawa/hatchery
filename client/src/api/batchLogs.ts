import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BatchRunLogSchema } from "@hatchery/common";
import type { BatchRunLog } from "@hatchery/common";

import { openApiClient } from "./client.js";

export const BATCH_LOGS_QUERY_KEY = ["admin", "batch-logs"] as const;

/**
 * GET /admin/batch-logs を openApiClient（生成型・baseUrl 解決）経由で取得する（ADR-0006・#110）。
 * 生の相対 fetch はクロスオリジン配信（#78）で baseUrl が前置されず壊れるため openApiClient に統一。
 * 現行どおり BatchRunLogSchema でランタイム検証し executedAt を Date 化する（挙動維持）。
 */
export async function fetchBatchLogs(): Promise<BatchRunLog[]> {
  const { data, error, response } = await openApiClient.GET("/api/admin/batch-logs", {
    credentials: "include",
  });
  // openapi-fetch は非2xx + 空ボディ（Content-Length: 0）で error=undefined を返すため、
  // error だけでなく response.ok も見て元コード（!res.ok throw）の確実性を保つ。
  if (error || !response.ok) throw new Error(`GET /api/admin/batch-logs failed: ${response.status}`);
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
