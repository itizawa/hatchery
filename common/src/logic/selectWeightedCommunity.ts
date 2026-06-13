/**
 * vote 重み付きランダムで 1 コミュニティを選ぶ純粋ロジック（#486 / ADR-0030）。
 *
 * 定時バッチが「毎定時に全コミュニティ」ではなく「1 定時 = 1 コミュニティ」を選ぶための
 * 累積重み法による選定。乱数源を注入できるので決定的にテストできる。
 *
 * 重み（weight）の算出（直近 N 日の純 vote スコア・床 +1 等）は呼び出し側（server）の責務で、
 * この関数は与えられた重みに従って 1 件を選ぶことだけを行う。
 */

/** 1 コミュニティの選定重み。weight は 0 以上を想定（床 +1 は呼び出し側で適用済み）。 */
export interface CommunityWeight {
  communityId: string;
  /** 選定重み（0 以上）。大きいほど選ばれやすい。 */
  weight: number;
}

/**
 * 重み付きランダムで 1 コミュニティの id を選んで返す（累積重み法）。
 *
 * @param communities 各コミュニティの id と重み。
 * @param rng 乱数源（`[0, 1)` を返す）。既定は `Math.random`。テストでは固定値を注入する。
 * @returns 選ばれたコミュニティ id。コミュニティが 0 件のときは null。
 *
 * - 0 件 → null。
 * - 1 件のみ → rng に関わらずそのコミュニティ。
 * - weight 0 のコミュニティは区間幅 0 のため、他に正の重みがある限り選ばれない。
 * - 全 weight が 0（total <= 0）のときは先頭コミュニティを返す（決定的なフォールバック）。
 * - 累積和とちょうど一致する境界値は次のコミュニティ（半開区間 `[累積前, 累積後)`）に割り当てる。
 * - 入力配列は破壊しない。
 */
export const selectWeightedCommunity = (
  communities: readonly CommunityWeight[],
  rng: () => number = Math.random,
): string | null => {
  if (communities.length === 0) return null;

  // 負の重みは 0 に丸めて扱う（呼び出し側で床 +1 済みの想定だが防御的に）。
  const total = communities.reduce((sum, c) => sum + Math.max(0, c.weight), 0);

  // 全 weight 0（total <= 0）なら先頭を決定的に返す。
  if (total <= 0) {
    return communities[0]!.communityId;
  }

  const r = rng() * total;
  let cumulative = 0;
  for (const community of communities) {
    cumulative += Math.max(0, community.weight);
    // 半開区間 [前累積, 後累積) に r が入るコミュニティを選ぶ。
    if (r < cumulative) {
      return community.communityId;
    }
  }

  // 浮動小数点誤差等で全区間を超えた場合は最後の正の重みを持つコミュニティを返す（フォールバック）。
  for (let i = communities.length - 1; i >= 0; i--) {
    if (Math.max(0, communities[i]!.weight) > 0) {
      return communities[i]!.communityId;
    }
  }
  return communities[0]!.communityId;
};
