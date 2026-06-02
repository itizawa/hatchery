import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppSettingResponse } from "@hatchery/common";

export const ADMIN_SETTINGS_QUERY_KEY = ["admin", "settings"] as const;

export type { AppSettingResponse };

async function fetchSettings(): Promise<AppSettingResponse[]> {
  const res = await fetch("/admin/settings", { credentials: "include" });
  if (!res.ok) throw new Error(`GET /admin/settings failed: ${res.status}`);
  return res.json() as Promise<AppSettingResponse[]>;
}

async function patchSetting(key: string, value: string): Promise<AppSettingResponse> {
  const res = await fetch("/admin/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ key, value }),
  });
  if (!res.ok) throw new Error(`PATCH /admin/settings failed: ${res.status}`);
  return res.json() as Promise<AppSettingResponse>;
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
