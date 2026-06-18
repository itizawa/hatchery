import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import type { Worker, WorkerListResponse } from "@hatchery/common";

import { ensureOk, openApiClient, unwrap } from "./client.js";
import { BOT_WORKERS_QUERY_KEY } from "./workers.js";

export const ADMIN_WORKERS_QUERY_KEY = ["admin", "workers"] as const;

export const ADMIN_WORKERS_PAGE_SIZE = 10;

/** DELETE /api/admin/workers/:id で Worker を論理削除する（#218 / #329）。 */
export async function deleteWorker(id: string): Promise<{ id: string; deletedAt: string }> {
  const result = await openApiClient.DELETE("/api/admin/workers/{id}", {
    params: { path: { id } },
    credentials: "include",
  });
  return unwrap(result, `DELETE /api/admin/workers/${id}`);
}

/** Worker 論理削除の useMutation フック（#218 / #329）。成功時はワーカー一覧のキャッシュを無効化する。 */
export function useDeleteWorker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteWorker(id),
    onSuccess: () => {
      // 管理画面ページネーションキャッシュ（全ページ）+ Bot Worker 一覧を両方無効化する。
      void queryClient.invalidateQueries({ queryKey: ADMIN_WORKERS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: BOT_WORKERS_QUERY_KEY });
    },
  });
}

/**
 * GET /api/workers をページネーションパラメータ付きで取得する（管理画面用・#545）。
 * page と limit を指定し、{ workers, total, page, limit } 形式のレスポンスを返す。
 */
export async function fetchAdminWorkers(
  page: number,
  limit: number,
): Promise<WorkerListResponse> {
  const result = await openApiClient.GET("/api/workers", {
    params: { query: { page, limit } },
    credentials: "include",
  });
  const data = ensureOk(result, "GET /api/workers");
  if (!data) throw new Error("GET /api/workers: empty response");
  return data as WorkerListResponse;
}

/** POST /api/admin/workers で新規 Worker を作成する（#217 / #329）。 */
export async function createAdminWorker(input: {
  displayName: string;
  role?: string;
  personality?: string;
}): Promise<Worker> {
  const result = await openApiClient.POST("/api/admin/workers", {
    body: input,
    credentials: "include",
  });
  return unwrap(result, "POST /api/admin/workers");
}

/**
 * 管理画面のワーカー一覧（ページネーション）を取得するフック（#217 / #329 / #545）。
 * useSuspenseQuery（#459/#463）。ローディング・エラーは呼び出し元の QueryBoundary に委譲する。
 * page は 1-indexed。queryKey にページ番号を含めて TanStack Query でページ別にキャッシュする。
 */
export function useAdminWorkers(page = 1) {
  return useSuspenseQuery({
    queryKey: [...ADMIN_WORKERS_QUERY_KEY, page] as const,
    queryFn: () => fetchAdminWorkers(page, ADMIN_WORKERS_PAGE_SIZE),
  });
}

/** 管理画面から新規 AI ワーカーを作成するミューテーションフック（#217 / #329）。 */
export function useCreateAdminWorker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { displayName: string; role?: string; personality?: string }) =>
      createAdminWorker(input),
    onSuccess: () => {
      // 管理画面の全ワーカー一覧 + Bot Worker 一覧（useBotWorkers）のキャッシュを両方無効化する。
      // 両者は同一の GET /api/workers を参照しているが queryKey が異なるため、それぞれ invalidate する。
      void queryClient.invalidateQueries({ queryKey: ADMIN_WORKERS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: BOT_WORKERS_QUERY_KEY });
    },
  });
}
