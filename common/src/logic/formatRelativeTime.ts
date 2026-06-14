const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

/**
 * 投稿時刻を日本語の相対時間文字列に整形する純粋関数（#502）。
 *
 * 基準時刻 `now` を引数で受け取り `Date.now()` をロジック内に埋め込まないため
 * テスト可能。DOM / React 非依存（ADR-0005）。
 *
 * - 60秒未満 / 未来: `たった今`
 * - 60秒以上60分未満: `N分前`（端数切り捨て）
 * - 60分以上24時間未満: `N時間前`（端数切り捨て）
 * - 24時間以上7日未満: `N日前`（端数切り捨て）
 * - 7日以上: `YYYY/M/D`（UTC 基準の絶対日付）
 * - 不正な Date（NaN）: 空文字（描画を破綻させない）
 *
 * @param target 投稿時刻
 * @param now 基準時刻（描画時の現在時刻）
 */
export const formatRelativeTime = (target: Date, now: Date): string => {
  const targetMs = target.getTime();
  const nowMs = now.getTime();
  if (Number.isNaN(targetMs) || Number.isNaN(nowMs)) return "";

  const diffMs = nowMs - targetMs;

  if (diffMs < MINUTE_MS) return "たった今";
  if (diffMs < HOUR_MS) return `${Math.floor(diffMs / MINUTE_MS)}分前`;
  if (diffMs < DAY_MS) return `${Math.floor(diffMs / HOUR_MS)}時間前`;
  if (diffMs < WEEK_MS) return `${Math.floor(diffMs / DAY_MS)}日前`;

  return `${target.getUTCFullYear()}/${target.getUTCMonth() + 1}/${target.getUTCDate()}`;
};
