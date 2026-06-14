import { formatRelativeTime } from "@hatchery/common";
import { Typography } from "./uiParts";
import type { ReactElement } from "react";

interface PostedTimeProps {
  /** 投稿時刻の ISO 文字列（post / comment の created_at）。未指定なら何も描画しない（後方互換）。 */
  createdAt?: string | null;
}

/**
 * 投稿時刻を相対時間（例「3時間前」、7日以上は日付）で表示する byline 要素（#502）。
 * - 機械可読な絶対時刻を `<time dateTime>` に持たせる（アクセシビリティ・将来のツールチップ拡張に備える）。
 * - createdAt が未指定 / 不正な日付なら何も描画しない（破綻させない）。
 */
export const PostedTime = ({ createdAt }: PostedTimeProps): ReactElement | null => {
  if (!createdAt) return null;

  const target = new Date(createdAt);
  if (Number.isNaN(target.getTime())) return null;

  const label = formatRelativeTime(target, new Date());
  if (label === "") return null;

  return (
    <Typography
      variant="body2"
      component="time"
      dateTime={target.toISOString()}
      sx={{ color: "text.secondary" }}
    >
      {label}
    </Typography>
  );
};
