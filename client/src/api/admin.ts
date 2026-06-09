import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppSettingResponse, Employee } from "@hatchery/common";

import { openApiClient } from "./client.js";
import { BOT_EMPLOYEES_QUERY_KEY } from "./employees.js";

export const ADMIN_SETTINGS_QUERY_KEY = ["admin", "settings"] as const;
export const ADMIN_EMPLOYEES_QUERY_KEY = ["admin", "employees"] as const;

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

/** DELETE /api/admin/employees/:id で Employee を論理削除する（#218）。 */
export async function deleteEmployee(id: string): Promise<{ id: string; deletedAt: string }> {
  const { data, response } = await openApiClient.DELETE("/api/admin/employees/{id}", {
    params: { path: { id } },
    credentials: "include",
  });
  if (!response.ok || !data) throw new Error(`DELETE /api/admin/employees/${id} failed: ${response.status}`);
  return data;
}

export const BOT_EMPLOYEES_ADMIN_QUERY_KEY = ["admin", "employees"] as const;

/** Employee 論理削除の useMutation フック（#218）。成功時は社員一覧のキャッシュを無効化する。 */
export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEmployee(id),
    onSuccess: () => {
      // 社員一覧を再取得するためキャッシュを無効化
      void queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
  });
}

/** GET /api/employees で isBot=true の Employee 一覧を取得する（管理画面ユーザー一覧用・#217）。 */
export async function fetchAdminEmployees(): Promise<Employee[]> {
  const { data, error, response } = await openApiClient.GET("/api/employees", {
    credentials: "include",
  });
  if (error || !response.ok) throw new Error(`GET /api/employees failed: ${response.status}`);
  return (data ?? []) as unknown as Employee[];
}

/** POST /api/admin/employees で新規 Employee（isBot=true）を作成する（#217）。 */
export async function createAdminEmployee(input: {
  displayName: string;
  role?: string;
  personality?: string;
}): Promise<Employee> {
  const { data, response } = await openApiClient.POST("/api/admin/employees", {
    body: input,
    credentials: "include",
  });
  if (!response.ok || !data) throw new Error(`POST /api/admin/employees failed: ${response.status}`);
  return data as unknown as Employee;
}

/** 管理画面のユーザー一覧（isBot=true の全 Employee）を取得するフック（#217）。 */
export function useAdminEmployees() {
  return useQuery({
    queryKey: ADMIN_EMPLOYEES_QUERY_KEY,
    queryFn: fetchAdminEmployees,
  });
}

/** 管理画面から新規 AI 社員（isBot=true）を作成するミューテーションフック（#217）。 */
export function useCreateAdminEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { displayName: string; role?: string; personality?: string }) =>
      createAdminEmployee(input),
    onSuccess: () => {
      // 管理画面の一覧 + OfficeScene・ChannelScene で共有する Bot Employee キャッシュを両方無効化する。
      // 両者は同一の GET /api/employees を参照しているが queryKey が異なるため、それぞれ invalidate する。
      void queryClient.invalidateQueries({ queryKey: ADMIN_EMPLOYEES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: BOT_EMPLOYEES_QUERY_KEY });
    },
  });
}
