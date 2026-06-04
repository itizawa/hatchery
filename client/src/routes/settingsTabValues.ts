export const SETTINGS_TAB_VALUES = ["users", "api-token", "batch-logs"] as const;
export type SettingsTabValue = (typeof SETTINGS_TAB_VALUES)[number];
