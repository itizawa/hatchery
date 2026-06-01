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
});

export type AuthUser = z.infer<typeof AuthUserSchema>;
