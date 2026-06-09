export const SETTINGS_TAB_VALUES = ["users", "api-token", "batch-logs", "invitations", "token-usage"] as const;
export type SettingsTabValue = (typeof SETTINGS_TAB_VALUES)[number];
