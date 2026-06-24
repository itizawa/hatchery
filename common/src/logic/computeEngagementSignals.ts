/**
 * コミュニティ帰属シグナルの集計ロジック（#761 / ADR-0033）。
 *
 * 集中度・シェア計算はアプリ非依存の純粋関数として common に置く。
 * DB アクセスを伴う集計（join・期間絞り）は server 側の責務。
 */

/**
 * ID 別集計 counts から share % 付きで count 降順リストを生成する。
 * 負の count は 0 として扱い、合計が 0 のときは sharePercent = 0 を返す。
 */
export function computeVoteShares({
  counts,
}: {
  counts: ReadonlyMap<string, number>;
}): Array<{ id: string; count: number; sharePercent: number }> {
  const entries = Array.from(counts.entries()).map(([id, raw]) => ({
    id,
    count: Math.max(0, raw),
  }));
  const total = entries.reduce((sum, e) => sum + e.count, 0);
  return entries
    .map((e) => ({
      id: e.id,
      count: e.count,
      sharePercent: total > 0 ? (e.count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * ユーザーごとの community vote 集中度（最大シェア）の平均を 0–1 で返す。
 *
 * 各ユーザーの「最大シェア」= 最も多く投票した community の vote 数 / そのユーザーの総 vote 数。
 * vote が 0 件のユーザーは計算対象から除外する。
 * ユーザーが 0 人（または全員 0 票）のとき 0 を返す。
 */
export function computeLoyaltyScore({
  userVotesByCommunity,
}: {
  userVotesByCommunity: ReadonlyMap<string, ReadonlyMap<string, number>>;
}): number {
  let totalMaxShare = 0;
  let userCount = 0;

  for (const votesMap of userVotesByCommunity.values()) {
    const counts = Array.from(votesMap.values()).filter((c) => c > 0);
    if (counts.length === 0) continue;
    const total = counts.reduce((s, c) => s + c, 0);
    const maxCount = Math.max(...counts);
    totalMaxShare += maxCount / total;
    userCount++;
  }

  return userCount === 0 ? 0 : totalMaxShare / userCount;
}
