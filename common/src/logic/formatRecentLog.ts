/**
 * Post/Comment を入力として直近ログを整形するための共通エントリ型（Issue #304 / ADR-0019）。
 * - community_id: コミュニティID（旧 channel に相当）
 * - author: 発言者のワーカーID（旧 createdEmployeeId に相当）
 * - text: 発言内容
 * - title: 投稿のタイトル（Post の場合に使用。Comment は省略可能）
 */
export interface RecentEntry {
  community_id: string;
  author: string;
  text: string;
  title?: string;
}

/**
 * 直近ログの整形（concept.md「ユーザーメッセージ（直近ログ）」/ タイムライン整形の共通土台）。
 * entries の末尾 n 件だけを対象に、各エントリを整形して返す。
 *
 * - title がある場合: `[community_id] author: title / text` 形式
 * - title がない場合: `[community_id] author: text` 形式
 *
 * - entries.length <= n のときは全件を返す。n <= 0 のときは空配列。
 * - 入力配列は破壊しない（slice / map のみ・副作用なし）。
 *
 * ADR-0019: Post/Comment モデルへの移行に対応（旧 Message 型からの更新）。
 */
export const formatRecentLog = (entries: readonly RecentEntry[], n: number): string[] => {
  if (n <= 0) return [];
  const start = Math.max(0, entries.length - n);
  return entries.slice(start).map((entry) => {
    const content = entry.title ? `${entry.title} / ${entry.text}` : entry.text;
    return `[${entry.community_id}] ${entry.author}: ${content}`;
  });
};
