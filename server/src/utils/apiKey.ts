import type { AppSettingRepository } from "../persistence/appSettingRepository.js";
import { decrypt } from "./crypto.js";

/**
 * バッチ実行時に使用する API キーを取得する。
 * DB の復号値を優先し、未設定なら anthropicApiKey 引数をフォールバックとして使う（#419）。
 */
export async function getApiKey(
  appSettingRepository: AppSettingRepository,
  anthropicApiKey?: string,
): Promise<string | undefined> {
  const setting = await appSettingRepository.findByKey("CLAUDE_API_KEY");
  if (setting?.value) {
    try {
      return decrypt(setting.value);
    } catch (err) {
      console.warn("[getApiKey] CLAUDE_API_KEY の復号に失敗しました。env フォールバックを使用します:", err instanceof Error ? err.message : String(err));
    }
  }
  return anthropicApiKey;
}
