import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthUserSchema, InvitationPublicSchema, InvitationSchema } from "@hatchery/common";
import type { AcceptInvitation, AuthUser, Invitation, InvitationPublic } from "@hatchery/common";

import { AUTH_ME_QUERY_KEY } from "./auth.js";
import { openApiClient } from "./client.js";

export const INVITATIONS_QUERY_KEY = ["admin", "invitations"] as const;
export const INVITATION_TOKEN_QUERY_KEY = (token: string) => ["invitation", token] as const;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function fetchInvitations(): Promise<Invitation[]> {
  const { data, error, response } = await openApiClient.GET("/api/admin/invitations", {
    credentials: "include",
  });
  if (error || !response.ok) throw new Error(`GET /api/admin/invitations failed: ${response.status}`);
  return InvitationSchema.array().parse(data);
}

export async function createInvitation(input: {
  expiresInHours: number;
  memo?: string;
}): Promise<Invitation> {
  const { data, error, response } = await openApiClient.POST("/api/admin/invitations", {
    body: input,
    credentials: "include",
  });
  if (error || !response.ok) throw new Error(`POST /api/admin/invitations failed: ${response.status}`);
  return InvitationSchema.parse(data);
}

export async function revokeInvitation(id: string): Promise<Invitation> {
  const { data, error, response } = await openApiClient.POST("/api/admin/invitations/{id}/revoke", {
    params: { path: { id } },
    credentials: "include",
  });
  if (error || !response.ok) throw new Error(`POST /api/admin/invitations/${id}/revoke failed: ${response.status}`);
  return InvitationSchema.parse(data);
}

export function useInvitations() {
  return useQuery({
    queryKey: INVITATIONS_QUERY_KEY,
    queryFn: fetchInvitations,
  });
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createInvitation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INVITATIONS_QUERY_KEY }),
  });
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => revokeInvitation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INVITATIONS_QUERY_KEY }),
  });
}

/** GET /api/invitations/:token — トークン検証（公開）。404 のとき null を返す。 */
export async function fetchInvitation(token: string): Promise<InvitationPublic | null> {
  const { data, response } = await openApiClient.GET("/api/invitations/{token}", {
    params: { path: { token } },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new ApiError(response.status, `GET /api/invitations/${token} failed: ${response.status}`);
  return InvitationPublicSchema.parse(data);
}

/** POST /api/invitations/:token/accept — 受諾・User 作成・自動ログイン（公開）。 */
export async function acceptInvitation(token: string, body: AcceptInvitation): Promise<AuthUser> {
  const { data, error, response } = await openApiClient.POST("/api/invitations/{token}/accept", {
    params: { path: { token } },
    body,
    credentials: "include",
  });
  if (!response.ok) {
    throw new ApiError(
      response.status,
      `POST /api/invitations/${token}/accept failed: ${response.status}`,
      error,
    );
  }
  return AuthUserSchema.parse(data);
}

export function useInvitation(token: string) {
  return useQuery({
    queryKey: INVITATION_TOKEN_QUERY_KEY(token),
    queryFn: () => fetchInvitation(token),
    retry: false,
  });
}

export function useAcceptInvitation(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AcceptInvitation) => acceptInvitation(token, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY }),
  });
}
