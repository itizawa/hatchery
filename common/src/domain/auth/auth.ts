import { z } from "zod";

export const LoginRequestSchema = z.object({
  id: z.string().min(1),
  password: z.string().min(1),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

// #136: ユーザー権限ロール（admin / member）。
export const UserRoleSchema = z.enum(["admin", "member"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const AuthUserSchema = z.object({
  id: z.string(),
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
  displayName: z.string().min(1),
  avatarUrl: z.string().url().optional(),
});

export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;
