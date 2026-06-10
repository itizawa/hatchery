import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppSettingResponse, Worker } from "@hatchery/common";

import { openApiClient } from "./client.js";
import { BOT_WORKERS_QUERY_KEY } from "./workers.js";

export const ADMIN_SETTINGS_QUERY_KEY = ["admin", "settings"] as const;
export const ADMIN_WORKERS_QUERY_KEY = ["admin", "workers"] as const;

export type { AppSettingResponse };

/**
 * GET /admin/settings を openApiClient（生成型・baseUrl 解決）経由で取得する（ADR-0006・#110）。
 * 生の相対 fetch はクロスオリジン配信（#78）で baseUrl が前置されず壊れるため openApiClient に統一。
 */
export async function fetchSettings(): Promise<AppSettingResponse[]> {
  const { data, error, response } = await openApiClient.GET("/api/admin/settings", {
    credentials: "include",
  });
  // openapi-fetch は非2xx + 空ボディ（Content-Length: 0）で error=undefined を返すため、
  // error だけでなく response.ok も見て元コード（!res.ok throw）の確実性を保つ。
  if (error || !response.ok) throw new Error(`GET /api/admin/settings failed: ${response.status}`);
  return data ?? [];
}

/** PATCH /admin/settings を openApiClient 経由で更新する（#110）。成功時は更新後の設定を返す。 */
export async function patchSetting(key: string, value: string): Promise<AppSettingResponse> {
  const { data, response } = await openApiClient.PATCH("/api/admin/settings", {
    body: { key, value },
    credentials: "include",
  });
  if (!response.ok || !data) throw new Error(`PATCH /api/admin/settings failed: ${response.status}`);
  return data;
}

export function useAdminSettings() {
  return useQuery({
    queryKey: ADMIN_SETTINGS_QUERY_KEY,
    queryFn: fetchSettings,
  });
}

export function useSaveAdminSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => patchSetting(key, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_SETTINGS_QUERY_KEY }),
  });
}

/** DELETE /api/admin/workers/:id で Worker を論理削除する（#218 / #329）。
 * NOTE: このエンドポイントは openapi.gen.ts に未登録（#305 マージ待ち）のため as any で呼ぶ。
 */
export async function deleteWorker(id: string): Promise<{ id: string; deletedAt: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, response } = await (openApiClient as any).DELETE("/api/admin/workers/{id}", {
    params: { path: { id } },
    credentials: "include",
  });
  if (!response.ok || !data) throw new Error(`DELETE /api/admin/workers/${id} failed: ${response.status}`);
  return data as { id: string; deletedAt: string };
}

export const BOT_WORKERS_ADMIN_QUERY_KEY = ["admin", "workers"] as const;

/** Worker 論理削除の useMutation フック（#218 / #329）。成功時はワーカー一覧のキャッシュを無効化する。 */
export function useDeleteWorker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteWorker(id),
    onSuccess: () => {
      // ワーカー一覧を再取得するためキャッシュを無効化
      void queryClient.invalidateQueries({ queryKey: ["workers"] });
    },
  });
}

/** GET /api/workers で isBot=true の Worker 一覧を取得する（管理画面ユーザー一覧用・#217 / #329）。 */
export async function fetchAdminWorkers(): Promise<Worker[]> {
  const { data, error, response } = await openApiClient.GET("/api/workers", {
    credentials: "include",
  });
  if (error || !response.ok) throw new Error(`GET /api/workers failed: ${response.status}`);
  return (data ?? []) as unknown as Worker[];
}

/** POST /api/admin/workers で新規 Worker（isBot=true）を作成する（#217 / #329）。
 * NOTE: このエンドポイントは openapi.gen.ts に未登録（#305 マージ待ち）のため as any で呼ぶ。
 */
export async function createAdminWorker(input: {
  displayName: string;
  role?: string;
  personality?: string;
}): Promise<Worker> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, response } = await (openApiClient as any).POST("/api/admin/workers", {
    body: input,
    credentials: "include",
  });
  if (!response.ok || !data) throw new Error(`POST /api/admin/workers failed: ${response.status}`);
  return data as unknown as Worker;
}

/** 管理画面のワーカー一覧（isBot=true の全 Worker）を取得するフック（#217 / #329）。 */
export function useAdminWorkers() {
  return useQuery({
    queryKey: ADMIN_WORKERS_QUERY_KEY,
    queryFn: fetchAdminWorkers,
  });
}

/** 管理画面から新規 AI ワーカー（isBot=true）を作成するミューテーションフック（#217 / #329）。 */
export function useCreateAdminWorker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { displayName: string; role?: string; personality?: string }) =>
      createAdminWorker(input),
    onSuccess: () => {
      // 管理画面の一覧 + OfficeScene・ChannelScene で共有する Bot Worker キャッシュを両方無効化する。
      // 両者は同一の GET /api/workers を参照しているが queryKey が異なるため、それぞれ invalidate する。
      void queryClient.invalidateQueries({ queryKey: ADMIN_WORKERS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: BOT_WORKERS_QUERY_KEY });
    },
  });
}

// ── 後方互換エクスポート（Employee → Worker リネーム #329） ────────────────────────
/** @deprecated Use ADMIN_WORKERS_QUERY_KEY */
export const ADMIN_EMPLOYEES_QUERY_KEY = ADMIN_WORKERS_QUERY_KEY;
/** @deprecated Use BOT_WORKERS_ADMIN_QUERY_KEY */
export const BOT_EMPLOYEES_ADMIN_QUERY_KEY = BOT_WORKERS_ADMIN_QUERY_KEY;
/** @deprecated Use deleteWorker */
export const deleteEmployee = deleteWorker;
/** @deprecated Use useDeleteWorker */
export const useDeleteEmployee = useDeleteWorker;
/** @deprecated Use fetchAdminWorkers */
export const fetchAdminEmployees = fetchAdminWorkers;
/** @deprecated Use useAdminWorkers */
export const useAdminEmployees = useAdminWorkers;
/** @deprecated Use createAdminWorker */
export const createAdminEmployee = createAdminWorker;
/** @deprecated Use useCreateAdminWorker */
export const useCreateAdminEmployee = useCreateAdminWorker;
