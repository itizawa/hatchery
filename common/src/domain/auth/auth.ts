import { z } from "zod";

export const LoginRequestSchema = z.object({
  id: z.string().min(1),
  password: z.string().min(1),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AuthUserSchema = z.object({
  id: z.string(),
  displayName: z.string(),
});

export type AuthUser = z.infer<typeof AuthUserSchema>;
