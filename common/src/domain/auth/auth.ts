import { z } from "zod";

export const DISPLAY_NAME_MAX_LENGTH = 100;
/** プロフィール画像 URL の最大文字数（#202）。URL の事実上の上限（RFC 準拠の実用値）。 */
export const AVATAR_URL_MAX_LENGTH = 2048;
/** Google プロフィールの email 最大文字数（RFC 5321 / RFC 5322 準拠の実用値）。 */
export const EMAIL_MAX_LENGTH = 254;

// #136: ユーザー権限ロール（admin / member）。
export const UserRoleSchema = z.enum(["admin", "member"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

// #455: Google-only auth へ移行。loginId を廃止し email を追加。
export const AuthUserSchema = z.object({
  id: z.string(),
  email: z.string().email().max(EMAIL_MAX_LENGTH),
  displayName: z.string(),
  // #136: 権限ロール（必須）。
  role: UserRoleSchema,
  // #51: プロフィール画像 URL（任意）。
  avatarUrl: z.string().optional(),
});

export type AuthUser = z.infer<typeof AuthUserSchema>;

// #136: role が admin かを判定する純粋関数。
export function isAdmin(user: Pick<AuthUser, "role">): boolean {
  return user.role === "admin";
}

// #51: PATCH /auth/me リクエストボディ。
export const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(DISPLAY_NAME_MAX_LENGTH),
  // #187: avatarUrl に .max() を追加してバリデーション規約を満たす。
  avatarUrl: z.string().url().max(AVATAR_URL_MAX_LENGTH).optional(),
});

export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;
