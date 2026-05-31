import type { AuthUser, LoginRequest } from "@hatchery/common";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { openApiClient } from "./client.js";

export const AUTH_ME_QUERY_KEY = ["auth", "me"] as const;

/**
 * GET /auth/me を openapi-fetch（生成型）経由で呼び出す。未ログイン（401）のときは null を返す。
 * ADR-0006: openapi.json 由来の型で server → client の型が end-to-end に流れる（#41）。
 */
export async function fetchMe(): Promise<AuthUser | null> {
  const { data, response } = await openApiClient.GET("/auth/me", { credentials: "include" });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`GET /auth/me failed: ${response.status}`);
  return data ?? null;
}

/** POST /auth/login を呼び出す。成功時は AuthUser を返す。失敗時は例外を投げる。 */
export async function login(body: LoginRequest): Promise<AuthUser> {
  const res = await fetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!res.ok) throw new Error(`POST /auth/login failed: ${res.status}`);
  return res.json() as Promise<AuthUser>;
}

/** POST /auth/logout を呼び出す。 */
export async function logout(): Promise<void> {
  const res = await fetch("/auth/logout", { method: "POST", credentials: "include" });
  if (!res.ok) throw new Error(`POST /auth/logout failed: ${res.status}`);
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

/** ログインミューテーションフック。成功後に auth キャッシュを無効化する。 */
export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: login,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY }),
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
