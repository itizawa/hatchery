import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { UpdateProfileSchema } from "@hatchery/common";
import { z } from "zod";

import type { RegistryContext } from "./shared.js";

/**
 * 認証（ADR-0029 / routes/auth.ts）の OpenAPI 登録（#535）。
 * #455: POST /api/auth/login は廃止。Google OAuth のみ。
 */
export function registerAuth(registry: OpenAPIRegistry, ctx: RegistryContext): void {
  const { errorJson, AuthUserComponent } = ctx;

  registry.registerPath({
    method: "post",
    path: "/api/auth/logout",
    summary: "ログアウト（セッション破棄）",
    responses: {
      200: {
        description: "ログアウト成功",
        content: { "application/json": { schema: z.object({ ok: z.boolean() }) } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/auth/me",
    summary: "現在の認証済みユーザーを取得（認証必須）",
    responses: {
      200: {
        description: "認証済みユーザー",
        content: { "application/json": { schema: AuthUserComponent } },
      },
      401: { description: "未認証", ...errorJson },
    },
  });

  const UpdateProfileComponent = registry.register(
    "UpdateProfile",
    UpdateProfileSchema.openapi({ description: "プロフィール更新リクエストボディ（#51）" }),
  );

  registry.registerPath({
    method: "patch",
    path: "/api/auth/me",
    summary: "自分自身のプロフィールを更新（認証必須・#51）",
    request: {
      body: { content: { "application/json": { schema: UpdateProfileComponent } } },
    },
    responses: {
      200: {
        description: "更新後の認証済みユーザー",
        content: { "application/json": { schema: AuthUserComponent } },
      },
      400: { description: "リクエストボディが不正（displayName 空セatvtarUrl 不正など）", ...errorJson },
      401: { description: "未認証", ...errorJson },
    },
  });

  // Google OAuth 認証（#343 / ADR-0027）。GOOGLE_CLIENT_ID 等が設定されている場合のみ有効。
  registry.registerPath({
    method: "get",
    path: "/api/auth/google",
    summary: "Google OAuth 認証画面へリダイレクト（#343）",
    responses: {
      302: { description: "Google OAuth 認証画面へリダイレクト（GOOGLE_CLIENT_ID 未設定時は 404）" },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/auth/google/callback",
    summary: "Google OAuth コールバック（#343）",
    responses: {
      302: { description: "認証成功: フロントエンドの / へリダイレクト。認証失敗: /login へリダイレクト" },
    },
  });
}
