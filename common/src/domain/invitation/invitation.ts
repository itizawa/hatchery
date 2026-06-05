import { z } from "zod";

export const InvitationStatusSchema = z.enum(["active", "used", "expired", "revoked"]);
export type InvitationStatus = z.infer<typeof InvitationStatusSchema>;

/** 招待リンク発行リクエスト（#131）。 */
export const CreateInvitationSchema = z.object({
  /** 有効期限（時間）。1〜720（最長 30 日）。 */
  expiresInHours: z.number().int().positive().max(720),
  /** 管理者用メモ（任意）。 */
  memo: z.string().max(200).optional(),
});
export type CreateInvitation = z.infer<typeof CreateInvitationSchema>;

/** 招待リンクのレスポンス（一覧/詳細）。内部情報は出さない。 */
export const InvitationSchema = z.object({
  id: z.string(),
  token: z.string(),
  expiresAt: z.coerce.date(),
  status: InvitationStatusSchema,
  memo: z.string().max(200).nullable(),
  createdAt: z.coerce.date(),
  usedAt: z.coerce.date().nullable(),
});
export type Invitation = z.infer<typeof InvitationSchema>;

type StatusInput = {
  revokedAt: Date | null;
  usedAt: Date | null;
  expiresAt: Date;
};

/**
 * 招待の現在ステータスを導出する純粋関数。
 * 優先順位: revoked > used > expired > active
 */
export function getInvitationStatus(input: StatusInput, now: Date): InvitationStatus {
  if (input.revokedAt !== null) return "revoked";
  if (input.usedAt !== null) return "used";
  if (input.expiresAt <= now) return "expired";
  return "active";
}
