import { z } from "zod";

/** Community の slug の最大文字数（#91）。 */
export const COMMUNITY_SLUG_MAX_LENGTH = 50;

/** Community の name の最大文字数（#91）。 */
export const COMMUNITY_NAME_MAX_LENGTH = 50;

/** Community の description の最大文字数（#91）。 */
export const COMMUNITY_DESCRIPTION_MAX_LENGTH = 500;

/** Community の synopsis の最大文字数（記憶③ / あらすじ）。 */
export const COMMUNITY_SYNOPSIS_MAX_LENGTH = 2000;

/**
 * コミュニティ（サブレディット相当）。ADR-0019。
 * admin が CRUD できる第一級エンティティ。
 * - slug / name / description に .max() 必須（#91）
 * - synopsis は世界観記憶③（このコミュニティのあらすじ）。省略可能。
 * - last_slot_key は最後に生成バッチが走った定時キー。省略可能（未生成の場合 null）。
 */
export const CommunitySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1).max(COMMUNITY_SLUG_MAX_LENGTH),
  name: z.string().min(1).max(COMMUNITY_NAME_MAX_LENGTH),
  description: z.string().min(1).max(COMMUNITY_DESCRIPTION_MAX_LENGTH),
  synopsis: z.string().max(COMMUNITY_SYNOPSIS_MAX_LENGTH).optional(),
  last_slot_key: z.string().optional(),
  created_at: z.date(),
});

export type Community = z.infer<typeof CommunitySchema>;
