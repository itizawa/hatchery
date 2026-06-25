import { formatAbsoluteTime, formatRelativeTime } from "@hatchery/common";
import { Tooltip, Typography } from "./uiParts";
import type { TypographyProps } from "@mui/material/Typography";
import type { ReactElement } from "react";

interface PostedTimeProps {
  /** 投稿時刻の ISO 文字列（post / comment の created_at）。未指定なら何も描画しない（後方互換）。 */
  createdAt?: string | null;
  /** Typography の variant。既定は body2。サイドバー等で caption に変えたい場合に指定する。 */
  variant?: TypographyProps["variant"];
}

/**
 * 投稿時刻を相対時間（24時間未満）または絶対日付（24時間以上）で表示する byline 要素（#502・#781）。
 * - 相対表示時はホバーで絶対日時のツールチップを表示する。
 * - 機械可読な絶対時刻を `<time dateTime>` に持たせる（アクセシビリティ）。
 * - createdAt が未指定 / 不正な日付なら何も描画しない（破綻させない）。
 */
export const PostedTime = ({ createdAt, variant = "body2" }: PostedTimeProps): ReactElement | null => {
  if (!createdAt) return null;

  const target = new Date(createdAt);
  if (Number.isNaN(target.getTime())) return null;

  const label = formatRelativeTime({ target, now: new Date() });
  if (label === "") return null;

  const absoluteLabel = formatAbsoluteTime({ target });

  return (
    <Tooltip title={absoluteLabel}>
      <Typography
        variant={variant}
        component="time"
        dateTime={target.toISOString()}
        sx={{ color: "text.secondary" }}
      >
        {label}
      </Typography>
    </Tooltip>
  );
};
