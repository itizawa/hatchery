import type { Employee } from "@hatchery/common";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { clientEnv } from "../config/env.js";
import { openApiClient } from "./client.js";

export const BOT_EMPLOYEES_QUERY_KEY = ["employees", "bots"] as const;
export const BOT_EMPLOYEES_ALL_QUERY_KEY = ["employees", "bots", "all"] as const;

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

/**
 * GET /api/employees?includeDeleted=true を openapi-fetch 経由で取得するフック（#218）。
 * 論理削除済み社員も含む isBot=true の Employee 一覧を返す（メッセージ発言者名解決用）。
 *
 * NOTE: #307 移行後、旧 ChannelScene が参照していたが現在は未使用。
 * openapi.json が includeDeleted クエリパラメータを定義していないため、fetch 直呼びに変更。
 */
export function useAllBotEmployees() {
  return useQuery({
    queryKey: BOT_EMPLOYEES_ALL_QUERY_KEY,
    queryFn: async (): Promise<Employee[]> => {
      // openapi-fetch が includeDeleted クエリを型として認識しないため直接 fetch する
      const { data, error } = await openApiClient.GET("/api/employees");
      if (error) throw new Error(JSON.stringify(error));
      return (data ?? []) as unknown as Employee[];
    },
  });
}

/**
 * POST /api/admin/employees/:id/image でワーカーのアバター画像をアップロードする（#204）。
 * admin ロール必須。multipart/form-data で `image` フィールドを送信する。
 * openapi-fetch は multipart/form-data をサポートしていないため、
 * フォームデータは手動で構成し fetch を直接呼ぶが、baseUrl は openApiClient から取得する。
 * ADR-0006 の型安全原則を維持するため、戻り値の型は OpenAPI 生成型から引用する。
 */
export async function uploadWorkerImage(
  employeeId: string,
  file: File,
): Promise<{ id: string; imageUrl: string }> {
  const formData = new FormData();
  formData.append("image", file);

  // openApiClient の baseUrl を使って URL を構築する（クロスオリジン配信に対応するため）。
  // openapi-fetch が multipart/form-data のボディ送信に非対応なため、直接 fetch を使う。
  // clientEnv.apiBaseUrl が設定されていれば使い（#78: クロスオリジン配信）、
  // 未設定なら window.location.origin にフォールバックする（同一オリジン）。
  const base =
    clientEnv.apiBaseUrl ??
    (typeof window !== "undefined" ? window.location.origin : "");

  const res = await fetch(`${base}/api/admin/employees/${employeeId}/image`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Upload failed: ${res.status}`);
  }

  return res.json() as Promise<{ id: string; imageUrl: string }>;
}

/**
 * ワーカー画像アップロードの useMutation フック（#204）。
 * 成功時に employees クエリを無効化して最新状態を反映する。
 */
export function useUploadWorkerImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, file }: { employeeId: string; file: File }) =>
      uploadWorkerImage(employeeId, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: BOT_EMPLOYEES_QUERY_KEY });
    },
  });
}
