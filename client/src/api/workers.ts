import type { Worker } from "@hatchery/common";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { clientEnv } from "../config/env.js";
import { openApiClient } from "./client.js";
import { buildApiErrorMessage } from "./errors.js";

export const BOT_WORKERS_QUERY_KEY = ["workers", "bots"] as const;

/**
 * GET /api/workers を openapi-fetch 経由で取得するフック（ADR-0006）。
 * Worker 一覧を返す（#240・管理画面のワーカー一覧表示等で使用）。
 * useSuspenseQuery（#459/#463）を使い、ローディング・エラーは呼び出し元の
 * QueryBoundary（Suspense + ErrorBoundary）に委譲する。data は undefined を取らない。
 */
export function useBotWorkers() {
  return useSuspenseQuery({
    queryKey: BOT_WORKERS_QUERY_KEY,
    queryFn: async (): Promise<Worker[]> => {
      const { data, error } = await openApiClient.GET("/api/workers");
      if (error) throw new Error(JSON.stringify(error));
      return data ?? [];
    },
  });
}

/**
 * PATCH /api/workers/:id を openApiClient 経由で呼ぶ mutation（#181）。
 * admin ロールのみ更新可（ADR-0018/0020）。
 * 成功後に Bot Worker 一覧を invalidate して最新データを反映する。
 */
export function useUpdateWorker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: { displayName?: string; role?: string; personality?: string; verbosity?: "concise" | "standard" | "detailed" };
    }) => {
      const { data, error, response } = await openApiClient.PATCH("/api/workers/{id}", {
        params: { path: { id } },
        body,
        credentials: "include",
      });
      // 失敗時はサーバが返す { error } メッセージを Error に乗せ、UI で原因を提示できるようにする（#476）。
      if (!response.ok || !data) {
        throw new Error(buildApiErrorMessage(error, response.status, "ワーカーの更新に失敗しました"));
      }
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BOT_WORKERS_QUERY_KEY }),
  });
}

/**
 * ワーカー画像アップロードの useMutation フック（#204）。
 * POST /api/admin/workers/:id/image でワーカーのアバター画像をアップロードする。
 * admin ロール必須。multipart/form-data で `image` フィールドを送信する。
 * openapi-fetch は multipart/form-data のボディ送信に非対応なため、
 * フォームデータは手動で構成し fetch を直接呼ぶが、baseUrl は openApiClient と
 * 同じ解決（#78: クロスオリジン配信）を行う。
 * 成功時に Bot Worker 一覧クエリを無効化して最新状態を反映する。
 */
export function useUploadWorkerImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      workerId,
      file,
    }: {
      workerId: string;
      file: File;
    }): Promise<{ id: string; imageUrl: string }> => {
      const formData = new FormData();
      formData.append("image", file);

      // clientEnv.apiBaseUrl が設定されていれば使い（#78: クロスオリジン配信）、
      // 未設定なら window.location.origin にフォールバックする（同一オリジン）。
      const base =
        clientEnv.apiBaseUrl ?? (typeof window !== "undefined" ? window.location.origin : "");

      const res = await fetch(`${base}/api/admin/workers/${workerId}/image`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Upload failed: ${res.status}`);
      }

      return res.json() as Promise<{ id: string; imageUrl: string }>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: BOT_WORKERS_QUERY_KEY });
    },
  });
}
