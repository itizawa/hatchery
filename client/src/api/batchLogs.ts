import { useCallback } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { BatchRunLogSchema } from "@hatchery/common";
import type { BatchRunLog } from "@hatchery/common";

import { ensureOk, openApiClient } from "./client.js";

export const BATCH_LOGS_QUERY_KEY = ["admin", "batch-logs"] as const;

/**
 * GET /admin/batch-logs を openApiClient（生成型・baseUrl 解決）経由で取得する（ADR-0006・#110）。
 * 生の相対 fetch はクロスオリジン配信（#78）で baseUrl が前置されず壊れるため openApiClient に統一。
 * 現行どおり BatchRunLogSchema でランタイム検証し executedAt を Date 化する（挙動維持）。
 */
export async function fetchBatchLogs(): Promise<BatchRunLog[]> {
  // ensureOk は error / !response.ok（非2xx + 空ボディの error=undefined ケース含む）を throw に変換する。
  // 空ボディ（data undefined）は ?? [] でフォールバックし、現行どおり Schema で検証して executedAt を Date 化する。
  const result = await openApiClient.GET("/api/admin/batch-logs", {
    credentials: "include",
  });
  return BatchRunLogSchema.array().parse(ensureOk(result, "GET /api/admin/batch-logs") ?? []);
}

/**
 * バッチ実行ログを取得するフック（#75）。
 * useSuspenseQuery（#459/#463）。ローディング・エラーは呼び出し元の QueryBoundary に委譲する。
 */
export function useBatchLogs() {
  return useSuspenseQuery({
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
