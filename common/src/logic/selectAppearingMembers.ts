import type { Employee } from "../domain/employee/index.js";

/**
 * 登場メンバー選定（concept.md「生成方式」のローテーション制御の純粋ロジック土台）。
 * 最終登場が古い（または未登場の）社員を優先して最大 count 名を選び、その id 配列を返す。
 *
 * @param employees 候補社員。
 * @param count 選ぶ最大人数。
 * @param lastAppearedBySlot 社員 id → 最終登場の定時番号（大きいほど新しい）。
 *   エントリが無い社員は未登場とみなし最優先で選ぶ。
 *
 * - 候補数が count 以下なら全員返す。count <= 0 なら空配列。
 * - 同点（同じ最終登場）は入力順を保つ安定ソートで、同入力に対し決定的。
 * - 入力（employees / lastAppearedBySlot）は破壊しない。
 */
export const selectAppearingMembers = (
  employees: readonly Employee[],
  count: number,
  lastAppearedBySlot: Readonly<Record<string, number>>,
): string[] => {
  if (count <= 0) return [];

  // 未登場は最優先（-Infinity）。小さいほど優先。同点は入力 index で安定化。
  const ranked = employees
    .map((employee, index) => {
      const last = lastAppearedBySlot[employee.id];
      return { id: employee.id, priority: last ?? Number.NEGATIVE_INFINITY, index };
    })
    .sort((a, b) => a.priority - b.priority || a.index - b.index);

  return ranked.slice(0, count).map((entry) => entry.id);
};
