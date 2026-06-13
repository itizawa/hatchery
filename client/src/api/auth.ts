import type { AuthUser, UpdateProfile } from "@hatchery/common";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { openApiClient } from "./client.js";

export const AUTH_ME_QUERY_KEY = ["auth", "me"] as const;

/**
 * GET /auth/me を openapi-fetch（生成型）経由で呼び出す。未ログイン（401）のときは null を返す。
 * ADR-0006: openapi.json 由来の型で server → client の型が end-to-end に流れる（#41）。
 */
export async function fetchMe(): Promise<AuthUser | null> {
  const { data, response } = await openApiClient.GET("/api/auth/me", { credentials: "include" });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`GET /api/auth/me failed: ${response.status}`);
  return data ?? null;
}

/** POST /auth/logout を呼び出す。openApiClient 経由で baseUrl を解決する。 */
export async function logout(): Promise<void> {
  const { response } = await openApiClient.POST("/api/auth/logout", { credentials: "include" });
  if (!response.ok) throw new Error(`POST /api/auth/logout failed: ${response.status}`);
}

/** 現在の認証状態を TanStack Query で取得するフック。 */
export function useAuth() {
  return useQuery({
    queryKey: AUTH_ME_QUERY_KEY,
    queryFn: fetchMe,
    staleTime: 60_000,
    retry: false,
  });
}

/** ログアウトミューテーションフック。成功後に auth キャッシュをクリアする。 */
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => queryClient.setQueryData(AUTH_ME_QUERY_KEY, null),
  });
}

/** PATCH /auth/me を呼び出す。成功時は更新後の AuthUser を返す。openApiClient 経由で baseUrl を解決する。 */
export async function updateProfile(body: UpdateProfile): Promise<AuthUser> {
  const { data, response } = await openApiClient.PATCH("/api/auth/me", {
    body,
    credentials: "include",
  });
  if (!response.ok || !data) throw new Error(`PATCH /api/auth/me failed: ${response.status}`);
  return data;
}

/** プロフィール更新ミューテーションフック。成功後に auth キャッシュを直接更新する（再フェッチ不要）。 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (data) => queryClient.setQueryData(AUTH_ME_QUERY_KEY, data),
  });
}
