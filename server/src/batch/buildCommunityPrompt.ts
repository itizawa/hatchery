import type { CommunityRecord } from "../persistence/communityRepository.js";

/** ワーカー定義（プロンプト構築に必要な最小フィールド）。 */
export interface WorkerDef {
  id: string;
  displayName: string;
  role?: string | null;
  isBot: boolean;
  personality?: string | null;
}

/** buildCommunityPrompt のパラメータ。 */
export interface BuildCommunityPromptParams {
  community: CommunityRecord;
  workers: readonly WorkerDef[];
  recentLog: readonly string[];
}

/**
 * community 単位の生成プロンプトを構築する（#306 / ADR-0019 / ADR-0020）。
 * - community の description（作風）を含める
 * - worker 定義（id / displayName / role / personality）を含める
 * - 直近ログ（formatRecentLog の出力）を含める
 * - お題（open_prompts）は含めない（ADR-0020）
 * - score は生成しない（ADR-0019）
 * - 出力形式: { topic, posts: [{ id, author, title, text, comments: [{ author, text }] }] }
 */
export function buildCommunityPrompt(params: BuildCommunityPromptParams): string {
  const { community, workers, recentLog } = params;

  const workerLines = workers
    .map((w) => {
      const parts = [`  - ID: ${w.id}`, `    名前: ${w.displayName}`];
      if (w.role) parts.push(`    役割: ${w.role}`);
      if (w.personality) parts.push(`    性格・バイブル: ${w.personality}`);
      return parts.join("\n");
    })
    .join("\n");

  const recentLogSection =
    recentLog.length > 0
      ? `直近の投稿・コメント（${recentLog.length} 件）:\n${recentLog.join("\n")}`
      : "直近の投稿・コメント: (なし)";

  const synopsisSection = community.synopsis
    ? `コミュニティのあらすじ:\n${community.synopsis}\n\n`
    : "";

  return `あなたはコミュニティ "${community.name}" に所属するAIワーカーです。
以下の設定とコンテキストに基づき、このコミュニティのスレッド（post + comment の掛け合い）を生成してください。

コミュニティ作風:
${community.description}

${synopsisSection}ワーカー一覧:
${workerLines}

${recentLogSection}

以下のJSON形式のみで出力してください（前後の説明・コードブロック不要）:
{
  "topic": "定時のトピック概要（1文）",
  "posts": [
    {
      "id": "p1",
      "author": "workerId（上記ワーカー一覧のIDから選択）",
      "title": "投稿タイトル",
      "text": "投稿本文",
      "comments": [
        {
          "author": "workerId（上記ワーカー一覧のIDから選択）",
          "text": "コメント本文"
        }
      ]
    }
  ]
}

注意事項:
- author には必ず上記ワーカー一覧の ID を使用してください
- score フィールドは生成しないでください
- posts は 1 件以上生成してください
- 会話は自然で読みやすい日本語で書いてください`;
}
