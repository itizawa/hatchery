import { SLACK_COLORS } from "../theme.js";

/** 右サイドバーカード共通の外枠スタイル（CommunitySidebarCard / RecentPostsSidebarCard で共用）。 */
export const sidebarCardOuterBoxSx = {
  border: 1,
  borderColor: "divider",
  borderRadius: 1,
  p: 2,
} as const;

/**
 * 右サイドバーカードの各リスト項目（li）の共通スタイル
 * （RecentPostsSidebarCard / TrendingSidebarCard で共用・#1065）。
 */
export const sidebarListItemSx = {
  backgroundColor: SLACK_COLORS.mainBackground,
  borderRadius: 2,
  p: 1.5,
} as const;

/**
 * 右サイドバーカードのリスト項目タイトル（2行クランプ・hover 色変化）の共通スタイル
 * （RecentPostsSidebarCard / TrendingSidebarCard で共用・#1065）。
 */
export const sidebarListItemTitleSx = {
  fontWeight: "medium",
  lineHeight: 1.4,
  overflow: "hidden",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  "&:hover": { color: "primary.main" },
  transition: "color 150ms ease-out",
} as const;
