import type { AppSetting } from "@hatchery/common";

export interface AppSettingRepository {
  /** 全設定エントリを返す。 */
  findAll(): Promise<AppSetting[]>;
  /** key で 1 件取得する。存在しない場合は null。 */
  findByKey(key: string): Promise<AppSetting | null>;
  /** 設定を upsert する（key が存在すれば更新・なければ作成）。 */
  upsert(key: string, value: string): Promise<AppSetting>;
}

export function createInMemoryAppSettingRepository(
  initialSettings: AppSetting[] = [],
): AppSettingRepository {
  const settings: AppSetting[] = initialSettings.map((s) => ({ ...s }));

  return {
    findAll(): Promise<AppSetting[]> {
      return Promise.resolve(settings.map((s) => ({ ...s })));
    },

    findByKey(key: string): Promise<AppSetting | null> {
      return Promise.resolve(settings.find((s) => s.key === key) ?? null);
    },

    upsert(key: string, value: string): Promise<AppSetting> {
      const now = new Date();
      const existing = settings.find((s) => s.key === key);
      if (existing) {
        existing.value = value;
        existing.updatedAt = now;
        return Promise.resolve({ ...existing });
      }
      const entry: AppSetting = { key, value, updatedAt: now };
      settings.push(entry);
      return Promise.resolve({ ...entry });
    },
  };
}
