import type { Worker } from "../domain/worker/index.js";

/**
 * 登場メンバー選定（concept.md「生成方式」のローテーション制御の純粋ロジック土台）。
 * 最終登場が古い（または未登場の）ワーカーを優先して最大 count 名を選び、その id 配列を返す。
 *
 * @param workers 候補ワーカー。
 * @param count 選ぶ最大人数。
 * @param lastAppearedBySlot ワーカー id → 最終登場の定時番号（大きいほど新しい）。
 *   エントリが無いワーカーは未登場とみなし最優先で選ぶ。
 *
 * - 候補数が count 以下なら全員返す。count <= 0 なら空配列。
 * - 同点（同じ最終登場）は入力順を保つ安定ソートで、同入力に対し決定的。
 * - 入力（workers / lastAppearedBySlot）は破壊しない。
 */
export const selectAppearingMembers = ({
  workers,
  count,
  lastAppearedBySlot,
}: {
  workers: readonly Worker[];
  count: number;
  lastAppearedBySlot: Readonly<Record<string, number>>;
}): string[] => {
  if (count <= 0) return [];

  // 未登場は最優先（-Infinity）。小さいほど優先。同点は入力 index で安定化。
  const ranked = workers
    // eslint-disable-next-line max-params
    .map((worker, index) => {
      const last = lastAppearedBySlot[worker.id];
      return { id: worker.id, priority: last ?? Number.NEGATIVE_INFINITY, index };
    })
    // eslint-disable-next-line max-params
    .sort((a, b) => a.priority - b.priority || a.index - b.index);

  return ranked.slice(0, count).map((entry) => entry.id);
};
