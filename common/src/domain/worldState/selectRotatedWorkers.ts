import type { WorkerState } from "./worldState.js";

/**
 * 登場ワーカーのローテーション選定（#464・concept.md 定時バッチ⑥）。
 *
 * `worldState.workerStates[workerId].lastAppearedSlotKey` の新旧だけで「最近登場していない
 * ワーカーを優先」して最大 `count` 名を選び、その id 配列を返す純粋関数。
 * 定時バッチ（runCommunityBatch）が同じワーカーの連続登場・全く登場しないワーカーの発生を
 * 防ぐための公平ローテーションに使う。
 *
 * slotKey は generateSlotKey の "YYYY-MM-DDTHH:MM" 形式で **辞書順 = 時系列順**のため、
 * 文字列の昇順比較で「古い順（=最近登場していない順）」を判定できる（日時パース不要）。
 *
 * 並べ替え方針:
 * - 未登場（lastAppearedSlotKey が undefined / エントリ無し）は最優先（最古扱い）。
 * - 登場済み同士は lastAppearedSlotKey の辞書順昇順（古いほど優先）。
 * - 同点（ともに未登場 / 同じ slotKey）は **入力順の安定ソート**で決定的。
 *
 * 境界:
 * - `count <= 0` → 空配列。
 * - 候補数 <= count → 全員をローテーション順に並べ替えて返す。
 * - 候補が空 → 空配列。
 *
 * 入力（workers / workerStates）は破壊しない。成長メカニクス（mood/関係値等）は使わない（ADR-0023）。
 *
 * @param workers 候補ワーカー（id を持つ任意の型）。
 * @param workerStates ワーカー id → WorkerState のマップ（worldState.workerStates）。
 * @param count 選ぶ最大人数。
 * @returns 登場させるワーカーの id 配列（ローテーション順）。
 */
export function selectRotatedWorkers<W extends { id: string }>(
  workers: readonly W[],
  workerStates: Readonly<Record<string, WorkerState>>,
  count: number,
): string[] {
  if (count <= 0) return [];

  const ranked = workers
    .map((worker, index) => ({
      id: worker.id,
      lastAppearedSlotKey: workerStates[worker.id]?.lastAppearedSlotKey,
      index,
    }))
    .sort((a, b) => {
      const aKey = a.lastAppearedSlotKey;
      const bKey = b.lastAppearedSlotKey;
      // 未登場（undefined）は最優先。
      if (aKey === undefined && bKey === undefined) return a.index - b.index;
      if (aKey === undefined) return -1;
      if (bKey === undefined) return 1;
      // 登場済み同士は slotKey 辞書順昇順（古いほど優先）。同点は入力順で安定化。
      if (aKey < bKey) return -1;
      if (aKey > bKey) return 1;
      return a.index - b.index;
    });

  return ranked.slice(0, count).map((entry) => entry.id);
}
