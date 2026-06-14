import { z } from "zod";

/** Community の slug の最大文字数（#91）。 */
export const COMMUNITY_SLUG_MAX_LENGTH = 50;

/** Community の name の最大文字数（#91）。 */
export const COMMUNITY_NAME_MAX_LENGTH = 50;

/** Community の description の最大文字数（#91）。 */
export const COMMUNITY_DESCRIPTION_MAX_LENGTH = 500;

/** Community の synopsis の最大文字数（記憑④ / あらすじ）。 */
export const COMMUNITY_SYNOPSIS_MAX_LENGTH = 2000;

/** Community の generationInstruction（非公開・生成プロンプト指示）の最大文字数（#488・#91）。 */
export const COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH = 2000;

/** Community のアイコン / カバー画像 URL の最大文字数（#457・#91。worker と同値）。 */
export const COMMUNITY_IMAGE_URL_MAX_LENGTH = 500;

/**
 * slug の形式バリデーション（#310）。
 * - 小文字英数字で始まり終わる
 * - 中間にハイフン（-）を含むことができる
 * - 大文字・アンダースコア・スペース・記号は不可
 * - 1 文字でも可（先頭末尾が同じ文字でも可）
 */
export const COMMUNITY_SLUG_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/** slug の Zod スキーマ（共通）。 */
const communitySlugSchema = z
  .string()
  .min(1)
  .max(COMMUNITY_SLUG_MAX_LENGTH)
  .regex(COMMUNITY_SLUG_REGEX, {
    message:
      "slug は小文字英数字とハイフンのみ使用でき、先頭と末尾は小文字英数字である必要があります",
  });

/**
 * コミュニティ（サブレディット相当）。ADR-0019。
 * admin が CRUD できる第一級エンティティ。
 * - slug / name / description に .max() 必須（#91）
 * - slug は小文字英数字・ハイフンのみ（#310）
 * - synopsis は世界観記憶④（このコミュニティのあらすじ）。省略可能。
 * - last_slot_key は最後に生成バッチが走った定時キー。省略可能（未生成の場合 null）。
 * - iconUrl / coverUrl は admin がアップロードした GCS 画像 URL（#457）。
 *   ともに任意セnullable（未設定時はプレースホルダ表示）。最大 500 文字（#91）。
 */
/** 公開コミュニティスキーマ。`generationInstruction` は含まない（#488）。 */
export const CommunitySchema = z.object({
  id: z.string().min(1),
  slug: communitySlugSchema,
  name: z.string().min(1).max(COMMUNITY_NAME_MAX_LENGTH),
  description: z.string().min(1).max(COMMUNITY_DESCRIPTION_MAX_LENGTH),
  synopsis: z.string().max(COMMUNITY_SYNOPSIS_MAX_LENGTH).optional(),
  last_slot_key: z.string().optional(),
  iconUrl: z.string().url().max(COMMUNITY_IMAGE_URL_MAX_LENGTH).nullable().optional(),
  coverUrl: z.string().url().max(COMMUNITY_IMAGE_URL_MAX_LENGTH).nullable().optional(),
  created_at: z.date(),
});

export type Community = z.infer<typeof CommunitySchema>;

/**
 * admin 向けコミュニティスキーマ（#488）。
 * 公開スキーマを extends し `generationInstruction`（非公開・生成プロンプト指示）を追加する。
 * admin API のレスポンスのみで使用し、公開エンドポイントには絶対に含めない。
 */
export const AdminCommunitySchema = CommunitySchema.extend({
  generationInstruction: z
    .string()
    .max(COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH)
    .nullable()
    .optional(),
});

export type AdminCommunity = z.infer<typeof AdminCommunitySchema>;

/**
 * コミュニティ作成リクエストスキーマ（#310）。
 * admin が community を新規作成する際のバリデーション。
 * id / created_at はサーバ側で採番するため含めない。
 */
export const CreateCommunitySchema = z.object({
  slug: communitySlugSchema,
  name: z.string().min(1).max(COMMUNITY_NAME_MAX_LENGTH),
  description: z.string().min(1).max(COMMUNITY_DESCRIPTION_MAX_LENGTH),
  generationInstruction: z
    .string()
    .max(COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH)
    .optional(),
});

export type CreateCommunityInput = z.infer<typeof CreateCommunitySchema>;

/**
 * コミュニティ更新リクエストスキーマ（#310）。
 * admin が community の name / description を編集する際のバリデーション。
 * slug は URL の永続性のため作成後変更不可（フィールドなし）。
 * id / created_at は更新対象外。
 */
export const UpdateCommunitySchema = z.object({
  name: z.string().min(1).max(COMMUNITY_NAME_MAX_LENGTH).optional(),
  description: z.string().min(1).max(COMMUNITY_DESCRIPTION_MAX_LENGTH).optional(),
  generationInstruction: z
    .string()
    .max(COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH)
    .nullable()
    .optional(),
});

export type UpdateCommunityInput = z.infer<typeof UpdateCommunitySchema>;
