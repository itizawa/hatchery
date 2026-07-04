import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  differenceInSeconds,
  format,
} from "date-fns";
import { UTCDate } from "@date-fns/utc";

const DAY_MS = 24 * 60 * 60_000;
const WEEK_MS = 7 * DAY_MS;

/**
 * 投稿時刻を日本語の相対時間文字列に整形する純粋関数（#502・#781・#848・#1016）。
 *
 * 基準時刻 `now` を引数で受け取り `Date.now()` をロジック内に埋め込まないため
 * テスト可能。DOM / React 非依存（ADR-0005）。
 *
 * - 1秒未満 / 未来: `たった今`
 * - 1秒以上60秒未満: `N秒前`
 * - 60秒以上60分未満: `N分前`（端数切り捨て）
 * - 60分以上24時間未満: `N時間前`（端数切り捨て）
 * - 24時間以上1週間（7日）未満: `N日前`（端数切り捨て）
 * - 1週間（7日）以上: `YYYY/M/D`（UTC 基準の絶対日付）
 * - 不正な Date（NaN）: 空文字（描画を破綻させない）
 *
 * @param target 投稿時刻
 * @param now 基準時刻（描画時の現在時刻）
 */
export const formatRelativeTime = ({ target, now }: { target: Date; now: Date }): string => {
  const targetMs = target.getTime();
  const nowMs = now.getTime();
  if (Number.isNaN(targetMs) || Number.isNaN(nowMs)) return "";

  const diffMs = nowMs - targetMs;

  if (diffMs < 1_000) return "たった今";

  const diffSeconds = differenceInSeconds(now, target);
  if (diffSeconds < 60) return `${diffSeconds}秒前`;

  const diffMinutes = differenceInMinutes(now, target);
  if (diffMinutes < 60) return `${diffMinutes}分前`;

  if (diffMs < DAY_MS) {
    return `${differenceInHours(now, target)}時間前`;
  }

  if (diffMs < WEEK_MS) {
    return `${differenceInDays(now, target)}日前`;
  }

  return format(new UTCDate(target), "yyyy/M/d");
};
