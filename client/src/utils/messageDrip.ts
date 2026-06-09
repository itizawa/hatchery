import type { Message } from "@hatchery/common";

/**
 * 新着メッセージを 1 件ずつ可視化する間隔（ミリ秒・#282 AC-4）。
 * この値ぶん待ってから次のメッセージのタイピングインジケータを開始する。
 */
export const DRIP_INTERVAL_MS = 700;

/**
 * 各メッセージ本文を出す直前にタイピングインジケータを表示する時間（ミリ秒・#282 AC-2 / AC-4）。
 */
export const TYPING_DURATION_MS = 900;

/**
 * ドリップ表示で扱うメッセージの最小形。永続化形 MessageRecord は安定 id を持つ（#40）。
 * Storybook fixture など id を持たない Message も受けられるよう id は optional とし、
 * その場合は index ベースのキーへフォールバックする（#282 設計判断 (a)）。
 */
export type DripMessage = Message & { id?: string };

/**
 * メッセージのドリップ用キーを返す。安定 id があればそれを、無ければ index ベースの
 * フォールバックキー（`idx-<index>`）を返す（#282 設計判断 (a)）。
 */
export const messageDripKey = (message: { id?: string }, index: number): string =>
  message.id ?? `idx-${index}`;

/** computeDrip の算出結果。 */
export interface DripState {
  /** メッセージ配列順のキー一覧（時系列。表示順の単一情報源）。 */
  allKeys: string[];
  /** 現時点で可視（本文を出してよい）キーの集合。 */
  visibleKeys: Set<string>;
  /** これから時系列順に 1 件ずつドリップ表示する新着キュー（未可視の新着キー）。 */
  queue: string[];
}

export interface ComputeDripOptions {
  /** true のとき新着も即時に可視化しキューを空にする（reduced-motion / 初回ロード相当）。 */
  immediate?: boolean;
}

/**
 * 「現在のメッセージ列」と「これまでに表示済みのキー集合」から、可視キー集合と
 * 新着ドリップキューを純粋に算出する（#282 AC-5・副作用なしでテスト可能）。
 *
 * - displayed が null（初回観測）のときは全件を表示済みとして即時可視化し、キューは空。
 *   → チャンネルを開いた初回ロードや、リロード後の過去ログは再生されない（AC-3）。
 * - displayed が与えられたときは、その集合に含まれないキーを「新着」とみなす。
 *   immediate=false なら新着はまだ不可視のままキューへ積み（時系列順）、
 *   immediate=true（reduced-motion 等）なら新着も即可視化しキューは空にする（AC-4）。
 *
 * 表示順は常にメッセージ配列の順序（時系列）を維持する（AC-1）。
 */
export const computeDrip = (
  messages: readonly DripMessage[],
  displayed: ReadonlySet<string> | null,
  options: ComputeDripOptions = {},
): DripState => {
  const allKeys = messages.map((m, i) => messageDripKey(m, i));

  if (displayed === null || options.immediate) {
    return {
      allKeys,
      visibleKeys: new Set(allKeys),
      queue: [],
    };
  }

  const visibleKeys = new Set<string>();
  const queue: string[] = [];
  for (const key of allKeys) {
    if (displayed.has(key)) {
      visibleKeys.add(key);
    } else {
      queue.push(key);
    }
  }

  return { allKeys, visibleKeys, queue };
};
