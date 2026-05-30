import type { Employee } from "../domain/employee/index.js";
import type { Message } from "../domain/message/index.js";

/** 0 以上 1 未満を返す乱数源。テストでは決定的な実装を注入する（既定 Math.random）。 */
export type Rng = () => number;

/**
 * 候補社員から count 名を**重複なくランダムに**選び、その id 配列を返す（#32）。
 * Fisher–Yates でコピーをシャッフルし、先頭 count 件を取り出す。
 *
 * - count <= 0 なら空配列。count が候補数以上なら全員（順序はシャッフル後）。
 * - rng を注入すれば決定的（同じ rng 列に対し同じ結果）。
 * - 入力 employees は破壊しない（コピーしてシャッフルする）。
 */
export const selectRandomMembers = (
  employees: readonly Employee[],
  count: number,
  rng: Rng = Math.random,
): string[] => {
  if (count <= 0) return [];
  const ids = employees.map((e) => e.id);
  // 末尾から i 番目を [0, i] のいずれかと入れ替える（Fisher–Yates シャッフル）。
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = ids[i] as string;
    ids[i] = ids[j] as string;
    ids[j] = tmp;
  }
  return ids.slice(0, Math.min(count, ids.length));
};

/** buildRosterMessages の入力。 */
export interface BuildRosterMessagesInput {
  /** 発言を投稿するチャンネル id 群。 */
  channels: readonly string[];
  /** 発言候補の社員。 */
  employees: readonly Employee[];
  /** 社員 id → 発言テンプレート群。 */
  templates: Readonly<Record<string, readonly string[]>>;
  /** 1 チャンネルあたり発言させる社員数。 */
  perChannel: number;
  /** 乱数源（既定 Math.random）。注入で決定的にできる。 */
  rng?: Rng;
}

/**
 * 定時の発言一覧を組み立てる純粋関数（#32 MVP）。
 * 各チャンネルで perChannel 名をランダム選定し、各社員の静的テンプレートから 1 文をランダムに選ぶ。
 * テンプレートが無い社員はスキップする。React/DOM/Node 非依存（ADR-0005）。
 */
export const buildRosterMessages = (input: BuildRosterMessagesInput): Message[] => {
  const rng = input.rng ?? Math.random;
  const messages: Message[] = [];
  for (const channel of input.channels) {
    const speakers = selectRandomMembers(input.employees, input.perChannel, rng);
    for (const speaker of speakers) {
      const candidates = input.templates[speaker] ?? [];
      if (candidates.length === 0) continue;
      const index = Math.floor(rng() * candidates.length);
      const text = candidates[index] as string;
      messages.push({ speaker, channel, text });
    }
  }
  return messages;
};
