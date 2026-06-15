/**
 * コメントに「じわじわ」公開するためのジッタ付きタイムスタンプを割り当てる純粋関数（#556）。
 *
 * バッチ生成時に全コメントが同時刻になる問題を解決するため、
 * 各コメントに単調増加するランダムオフセットを持つ「未来の createdAt」を割り当てる。
 * 読み取り側の `createdAt <= now` フィルタと組み合わせることで、
 * リロードのたびに時間経過分だけコメントが解禁される体験を実現する（ADR-0009 / ADR-0030）。
 */

export interface AssignDripTimestampsOptions {
  /** このスロットの開始時刻（通常は deps.now と同一）。 */
  slotAt: Date;
  /** ドリップ窓（次スロットまでの ms）。この窓の中にタイムスタンプを散らす。 */
  windowMs: number;
  /** 生成するタイムスタンプの件数。 */
  count: number;
  /** 乱数源（[0, 1)）。テストで固定値を注入して決定化する。 */
  rng: () => number;
}

/**
 * スロット時刻を起点に、単調増加するジッタ付きタイムスタンプを count 件生成する。
 *
 * アルゴリズム:
 * 1. 窓を count 件で等分した区間幅 `step = windowMs / count` を基準にする。
 * 2. 最初のオフセット: `offset_0 = rng() * step`（0 〜 step）
 * 3. 後続のオフセット: `offset_i = offset_{i-1} + step * (0.5 + rng() * 0.5)`
 *    （最小 step/2、最大 step、平均 3/4 * step の単調増加）
 * 4. 全タイムスタンプが `[slotAt, slotAt + windowMs)` に収まるよう上限クランプ。
 *
 * @returns 長さ count の Date 配列（単調増加が保証される）。count === 0 のとき空配列。
 */
export function assignDripTimestamps(options: AssignDripTimestampsOptions): Date[] {
  const { slotAt, windowMs, count, rng } = options;

  if (count === 0) return [];

  const step = windowMs / count;
  const slotMs = slotAt.getTime();
  const maxMs = slotMs + windowMs;

  const timestamps: Date[] = [];
  let offset = rng() * step;

  for (let i = 0; i < count; i++) {
    // 上限クランプ: windowMs - 1ms 以下に収める（windowMs は exclusive）
    const clamped = Math.min(slotMs + offset, maxMs - 1);
    timestamps.push(new Date(clamped));

    // 次のオフセット: 最小 step/2、最大 step のランダム増分で単調増加
    offset += step * (0.5 + rng() * 0.5);
  }

  return timestamps;
}
