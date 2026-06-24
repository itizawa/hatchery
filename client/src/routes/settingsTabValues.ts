export const SETTINGS_TAB_VALUES = ["users", "batch-logs", "token-usage", "communities", "community-engagement"] as const;
export type SettingsTabValue = (typeof SETTINGS_TAB_VALUES)[number];
