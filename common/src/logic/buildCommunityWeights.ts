/**
 * コミュニティ重み計算（#597 / ADR-0030）。
 *
 * 直近 N 日の community 別純 vote スコア（up−down）から
 * 重み付き選定に使う CommunityWeight[] を生成する純粋関数。
 * vote 集計（DB アクセス）は呼び出し側（server）の責務で、
 * この関数は与えられた net スコア Map を CommunityWeight 配列に変換するだけを行う。
 */

import type { CommunityWeight } from "./selectWeightedCommunity.js";

/**
 * community ID 配列と net vote スコア Map から重み付き選定用の CommunityWeight[] を生成する。
 *
 * 重みの算出方針（ADR-0030）:
 * - `weight = max(0, 純vote) + 1`
 * - cold start 床 +1 により vote 0・新規コミュニティも必ず正の重みを持ち、稀に選ばれる。
 * - 負の net vote は 0 に丸めて床 +1 のみとする。
 *
 * @param communityIds 対象コミュニティの ID 配列（順序保持）。
 * @param netScores community ID → 純 vote スコア のマップ。エントリがない場合は 0 扱い。
 * @returns 各コミュニティの CommunityWeight 配列（communityIds と同順）。
 */
export function buildCommunityWeights({
  communityIds,
  netScores,
}: {
  communityIds: readonly string[];
  netScores: ReadonlyMap<string, number>;
}): CommunityWeight[] {
  return communityIds.map((communityId) => ({
    communityId,
    // cold start 床: weight = max(0, 純vote) + 1。
    weight: Math.max(0, netScores.get(communityId) ?? 0) + 1,
  }));
}
