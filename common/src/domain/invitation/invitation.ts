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

export const ACCEPT_INVITATION_ID_MAX_LENGTH = 50;
export const ACCEPT_INVITATION_DISPLAY_NAME_MAX_LENGTH = 100;
export const ACCEPT_INVITATION_PASSWORD_MIN_LENGTH = 8;
export const ACCEPT_INVITATION_PASSWORD_MAX_LENGTH = 100;

/** 招待受諾リクエスト（#132）。新規ユーザーが招待リンクから登録する際のボディ。 */
export const AcceptInvitationSchema = z.object({
  /** 新規ユーザーのログイン ID。 */
  id: z.string().min(1).max(ACCEPT_INVITATION_ID_MAX_LENGTH),
  /** 表示名。 */
  displayName: z.string().min(1).max(ACCEPT_INVITATION_DISPLAY_NAME_MAX_LENGTH),
  /** パスワード（8 文字以上・100 文字以内）。bcrypt ハッシュ化して保存する。 */
  password: z
    .string()
    .min(ACCEPT_INVITATION_PASSWORD_MIN_LENGTH)
    .max(ACCEPT_INVITATION_PASSWORD_MAX_LENGTH),
});
export type AcceptInvitation = z.infer<typeof AcceptInvitationSchema>;

/** 招待トークン検証レスポンス（公開 API）。機微情報を出さない（#132）。 */
export const InvitationPublicSchema = z.object({
  status: InvitationStatusSchema,
  expiresAt: z.coerce.date(),
});
export type InvitationPublic = z.infer<typeof InvitationPublicSchema>;

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
