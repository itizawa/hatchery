/**
 * community 単位の登場ワーカーを解決する純粋関数（#489）。
 *
 * 定時バッチは `WorkerCommunity` 経由で community に紐づくワーカーを DB から取得し、
 * この関数で「実際に会話生成・author 検証に使うワーカー集合」を決める。
 *
 * フォールバック方針（受け入れ条件 3 の「決め」）:
 * - community に紐づくワーカーが 1 件以上 → それをそのまま使う。
 * - 0 件 → 全 Bot ワーカーへフォールバックする（生成スキップではなく全 Bot を対象にする）。
 *   stg 移行期や WorkerCommunity 未登録の community でも会話生成を止めないため。
 * - 全 Bot ワーカーも 0 件なら空配列を返す（呼び出し側で生成スキップ）。
 *
 * @param communityWorkers community に紐づくワーカー
 * @param allBotWorkers 全 Bot ワーカー（フォールバック候補）
 * @returns 会話生成・author 検証に使うワーカー集合
 */
export function selectCommunityWorkers<W extends { id: string }>(
  communityWorkers: readonly W[],
  allBotWorkers: readonly W[],
): readonly W[] {
  if (communityWorkers.length > 0) {
    return communityWorkers;
  }
  return allBotWorkers;
}
