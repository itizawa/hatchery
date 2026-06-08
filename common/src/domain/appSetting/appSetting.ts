import { z } from "zod";

export const APP_SETTING_KEY_MAX_LENGTH = 100;
export const APP_SETTING_VALUE_MAX_LENGTH = 1000;

/** アプリ設定のキーバリューエントリ（DB の AppSetting モデルに対応）。 */
export const AppSettingSchema = z.object({
  key: z.string().min(1).max(APP_SETTING_KEY_MAX_LENGTH),
  value: z.string(),
  updatedAt: z.date(),
});

export type AppSetting = z.infer<typeof AppSettingSchema>;

/** 設定を更新するリクエストボディ。key と value を指定する。 */
export const UpdateAppSettingSchema = z.object({
  key: z.string().min(1).max(APP_SETTING_KEY_MAX_LENGTH),
  value: z.string().max(APP_SETTING_VALUE_MAX_LENGTH),
});

export type UpdateAppSettingInput = z.infer<typeof UpdateAppSettingSchema>;

/** API レスポンス用: value はマスク表示。 */
export const AppSettingResponseSchema = z.object({
  key: z.string(),
  maskedValue: z.string().nullable(),
});

export type AppSettingResponse = z.infer<typeof AppSettingResponseSchema>;
