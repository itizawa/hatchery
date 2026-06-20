/**
 * 投稿時刻の完全な絶対日時文字列を返す純粋関数（#781）。
 *
 * UTC 基準で `YYYY/M/D H:MM:SS` 形式に整形する。
 * 月・日・時は 1 桁のときゼロパディングしない。分・秒は 2 桁ゼロパディングする。
 * DOM / React 非依存（ADR-0005）。
 *
 * - 正常: `YYYY/M/D H:MM:SS`
 * - 不正な Date（NaN）: 空文字（描画を破綻させない）
 *
 * @param target 投稿時刻
 */
export const formatAbsoluteTime = ({ target }: { target: Date }): string => {
  if (Number.isNaN(target.getTime())) return "";

  const year = target.getUTCFullYear();
  const month = target.getUTCMonth() + 1;
  const day = target.getUTCDate();
  const hours = target.getUTCHours();
  const minutes = String(target.getUTCMinutes()).padStart(2, "0");
  const seconds = String(target.getUTCSeconds()).padStart(2, "0");

  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
};
