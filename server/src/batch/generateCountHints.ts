/**
 * post 数・コメント数のヒント（件数誘導）。
 * 呼び出し側が buildCommunityPrompt に渡し、プロンプトへの件数指示に使う（#557）。
 */
export interface CountHints {
  /** 目標 post 数（プロンプト上の誘導。ハード制約ではない）。 */
  postCount: number;
  /** 各 post の目標コメント数（プロンプト上の誘導。ハード制約ではない）。 */
  commentCount: number;
}

/**
 * [min, max] の閉区間から一様分布で整数を 1 つ選ぶ純粋関数（#557）。
 *
 * @param min 範囲の下限（含む）
 * @param max 範囲の上限（含む）
 * @param rng 乱数源 `[0, 1)`。テストでは固定値を渡して決定化できる。
 * @returns min 以上 max 以下の整数
 */
export function pickInRange(min: number, max: number, rng: () => number): number {
  // [0, 1) を [min, max] の整数に写す: floor((max - min + 1) * rng) + min
  // rng = 0 → min, rng → 1 のとき → max
  return Math.floor((max - min + 1) * rng()) + min;
}

/**
 * post 数・コメント数のヒントをランダムに決定する純粋関数（#557）。
 *
 * 範囲（min/max）と乱数源（rng）から目標件数を決め、CountHints として返す。
 * rng を注入することで決定化できる（テスト容易性）。
 *
 * @param postRange post 数の範囲（min: 1以上, max: min以上）
 * @param commentRange 各 post のコメント数の範囲
 * @param rng 乱数源 `[0, 1)`
 */
export function generateCountHints(
  postRange: { min: number; max: number },
  commentRange: { min: number; max: number },
  rng: () => number,
): CountHints {
  const postCount = pickInRange(postRange.min, postRange.max, rng);
  const commentCount = pickInRange(commentRange.min, commentRange.max, rng);
  return { postCount, commentCount };
}
