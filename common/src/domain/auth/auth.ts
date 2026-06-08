import { z } from "zod";

export const LOGIN_ID_MAX_LENGTH = 50;
export const PASSWORD_MAX_LENGTH = 100;
export const DISPLAY_NAME_MAX_LENGTH = 100;
/** プロフィール画像 URL の最大文字数（#202）。URL の事実上の上限（RFC 準拠の実用値）。 */
export const AVATAR_URL_MAX_LENGTH = 2048;

export const LoginRequestSchema = z.object({
  // #185: id → loginId にリネーム（サロゲートキー化対応）。
  loginId: z.string().min(1).max(LOGIN_ID_MAX_LENGTH),
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

// #136: ユーザー権限ロール（admin / member）。
export const UserRoleSchema = z.enum(["admin", "member"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const AuthUserSchema = z.object({
  id: z.string(),
  // #185: ログイン用の人間可読 ID（サロゲートキー化後に loginId として公開）。
  loginId: z.string(),
  displayName: z.string(),
  // #136: 権限ロール（必須）。
  role: UserRoleSchema,
  // #49: 自身に紐づく Employee の id（User ↔ Employee の JOIN 結果）。未紐づけなら省略する。
  employeeId: z.string().optional(),
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
