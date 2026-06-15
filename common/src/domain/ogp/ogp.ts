import { z } from "zod";

/** OGP 取得プロキシの URL クエリパラメータの最大文字数（#515）。 */
export const OGP_URL_MAX_LENGTH = 2048;

/**
 * OGP 取得エンドポイント（GET /api/ogp?url=<url>）のクエリパラメータスキーマ（#515）。
 * - .max() 必須（#91）
 * - http/https スキームのみ許可（SSRF・XSS 対策）
 */
export const OgpUrlQuerySchema = z.object({
  url: z
    .string()
    .min(1)
    .max(OGP_URL_MAX_LENGTH)
    .refine(
      (val) => {
        try {
          const parsed = new URL(val);
          return parsed.protocol === "http:" || parsed.protocol === "https:";
        } catch {
          return false;
        }
      },
      { message: "url は http または https スキームの有効な URL である必要があります" },
    ),
});

export type OgpUrlQuery = z.infer<typeof OgpUrlQuerySchema>;

/**
 * OGP メタデータのレスポンススキーマ（#515）。
 * すべてのフィールドは optional / nullable（OGP が存在しない場合は null）。
 */
export const OgpMetaSchema = z.object({
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  site_name: z.string().nullable().optional(),
});

export type OgpMeta = z.infer<typeof OgpMetaSchema>;
