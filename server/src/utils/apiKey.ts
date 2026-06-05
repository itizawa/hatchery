import type { AppSettingRepository } from "../persistence/appSettingRepository.js";
import { decrypt } from "./crypto.js";

/**
 * バッチ実行時に使用する API キーを取得する。
 * DB の復号値を優先し、未設定なら環境変数 ANTHROPIC_API_KEY をフォールバックとして使う。
 */
export async function getApiKey(
  appSettingRepository: AppSettingRepository,
): Promise<string | undefined> {
  const setting = await appSettingRepository.findByKey("CLAUDE_API_KEY");
  if (setting?.value) {
    try {
      return decrypt(setting.value);
    } catch {
      // 復号失敗時は env フォールバック
    }
  }
  return process.env.ANTHROPIC_API_KEY ?? undefined;
}
