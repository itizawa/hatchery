/** AI メッセージの posted_at オフセット計算オプション（#183）。 */
export interface CalcPostedAtOffsetsOptions {
  /** 1 番目の AI メッセージまでの遅延（ms）。既定 60_000（1 分）。 */
  baseDelayMs?: number;
  /** AI メッセージ間の間隔（ms）。既定 30_000（30 秒）。 */
  intervalMs?: number;
}

/**
 * AI メッセージの `postedAt` 値を計算する純粋関数（#183）。
 * baseTime を起点に、baseDelayMs 後から intervalMs 間隔で count 件の Date を返す。
 */
export const calcPostedAtOffsets = ({
  baseTime,
  count,
  options,
}: {
  baseTime: Date;
  count: number;
  options?: CalcPostedAtOffsetsOptions;
}): Date[] => {
  if (count <= 0) return [];

  const baseDelayMs = options?.baseDelayMs ?? 60_000;
  const intervalMs = options?.intervalMs ?? 30_000;
  const baseMs = baseTime.getTime();

  return Array.from(
    { length: count },
    // eslint-disable-next-line max-params
    (_, i) => new Date(baseMs + baseDelayMs + i * intervalMs),
  );
};
