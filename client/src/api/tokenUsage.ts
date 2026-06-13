import { useCallback } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { TokenUsageLogSchema } from "@hatchery/common";
import type { TokenUsageLog } from "@hatchery/common";
import { z } from "zod";

import { openApiClient } from "./client.js";

export const TOKEN_USAGE_QUERY_KEY = ["admin", "token-usage"] as const;

/** トークン使用量の集計型。 */
export interface TokenUsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
}

/** GET /admin/token-usage のレスポンス型。 */
export interface TokenUsageResult {
  logs: TokenUsageLog[];
  summary: TokenUsageSummary;
}

/** TokenUsageSummary の Zod スキーマ。 */
const TokenUsageSummarySchema = z.object({
  totalInputTokens: z.number().int().nonnegative(),
  totalOutputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
});

/**
 * GET /admin/token-usage を openApiClient 経由で取得する（ADR-0006・#153）。
 * TokenUsageLogSchema でランタイム検証し occurredAt を Date 化する。
 */
export async function fetchTokenUsage(): Promise<TokenUsageResult> {
  const { data, error, response } = await openApiClient.GET("/api/admin/token-usage", {
    credentials: "include",
  });
  if (error || !response.ok) throw new Error(`GET /api/admin/token-usage failed: ${response.status}`);
  const raw = data as { logs: unknown[]; summary: unknown };
  const logs = TokenUsageLogSchema.array().parse(raw.logs);
  const summary = TokenUsageSummarySchema.parse(raw.summary);
  return { logs, summary };
}

/**
 * トークン使用量を取得するフック（#153）。
 * useSuspenseQuery（#459/#463）。ローディング・エラーは呼び出し元の QueryBoundary に委譲する。
 */
export function useTokenUsage() {
  return useSuspenseQuery({
    queryKey: TOKEN_USAGE_QUERY_KEY,
    queryFn: fetchTokenUsage,
  });
}

export function useRefreshTokenUsage() {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: TOKEN_USAGE_QUERY_KEY }),
    [queryClient],
  );
}
