/**
 * 投稿・コメント本文中に含まれる既知ワーカーの表示名を検出する純粋関数（#1163）。
 * ユーザーが `@名前` を入力するメンションは Hatchery の設計上成立しない（ADR-0020）ため、
 * AI 生成本文中に自然に現れる表示名を検出してプロフィールへの自動リンクに使う。
 */

export interface WorkerMentionCandidate {
  readonly id: string;
  readonly displayName: string;
}

export interface WorkerMention {
  readonly workerId: string;
  readonly displayName: string;
  readonly start: number;
  readonly end: number;
}

/** 誤検出リスクが高い短すぎる表示名（コードポイント単位）は検出対象から除外する。 */
export const MIN_WORKER_MENTION_DISPLAY_NAME_LENGTH = 2;

/**
 * `text` 中で `workers` の表示名に完全一致する部分文字列を検出する。
 * 表示名が別ワーカーの表示名の部分文字列になっているケース（「ken」と「kenta」）で
 * 誤って両方リンクされないよう、表示名の長い候補から順に一致範囲を確保し、
 * 既に確保された範囲と重なる出現は採用しない（最長一致優先）。
 *
 * 既知の制約: 候補リストに無い単語の内部に表示名がたまたま含まれるケース
 * （例: 表示名「ケン」が無関係な単語「ケンカ」にマッチする）は防げない。単語境界チェックは
 * 日本語の敬称（「さん」等が名前に直接続く）を誤って除外してしまうため採用しない
 * （docs/design/issue-1163.md §7 参照）。
 */
export function detectWorkerMentions({
  text,
  workers,
}: {
  text: string;
  workers: readonly WorkerMentionCandidate[];
}): WorkerMention[] {
  const candidates = [...workers]
    .filter(
      (worker) => [...worker.displayName].length >= MIN_WORKER_MENTION_DISPLAY_NAME_LENGTH,
    )
    // コードポイント単位の長さで比較する（サロゲートペアを含む表示名で UTF-16 単位長と
    // 順位がずれ、最長一致優先の判定を誤らないようにするため）。
    // eslint-disable-next-line max-params
    .sort((a, b) => [...b.displayName].length - [...a.displayName].length);

  const claimedRanges: Array<{ start: number; end: number }> = [];
  const mentions: WorkerMention[] = [];

  for (const worker of candidates) {
    let searchFrom = 0;
    while (searchFrom <= text.length) {
      const start = text.indexOf(worker.displayName, searchFrom);
      if (start === -1) break;
      const end = start + worker.displayName.length;
      const overlapsClaimedRange = claimedRanges.some(
        (range) => start < range.end && end > range.start,
      );
      if (!overlapsClaimedRange) {
        claimedRanges.push({ start, end });
        mentions.push({ workerId: worker.id, displayName: worker.displayName, start, end });
      }
      searchFrom = start + 1;
    }
  }

  // eslint-disable-next-line max-params
  return mentions.sort((a, b) => a.start - b.start);
}
