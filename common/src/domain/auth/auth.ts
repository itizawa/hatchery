import { z } from "zod";

export const LoginRequestSchema = z.object({
  id: z.string().min(1),
  password: z.string().min(1),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AuthUserSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  // #49: 自身に紐づく Employee の id（User ↔ Employee の JOIN 結果）。未紐づけなら省略する。
  employeeId: z.string().optional(),
  // #51: プロフィール画像 URL（任意）。
  avatarUrl: z.string().optional(),
});

export type AuthUser = z.infer<typeof AuthUserSchema>;

// #51: PATCH /auth/me リクエストボディ。
export const UpdateProfileSchema = z.object({
  displayName: z.string().min(1),
  avatarUrl: z.string().url().optional(),
});

export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;
