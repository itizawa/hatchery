import type { CommunityRecord } from "../persistence/communityRepository.js";
import type { WorkerDef } from "./buildCommunityPrompt.js";
import { TONE_GUIDELINES } from "./buildCommunityPrompt.js";

/** buildPostPrompt のパラメータ。 */
export interface BuildPostPromptParams {
  community: CommunityRecord;
  workers: readonly WorkerDef[];
  recentLog: readonly string[];
  /** post 件数ヒント（件数誘導）。省略時は「1 件以上」の従来挙動。 */
  countHints?: { postCount: number };
  /**
   * 直近の post タイトル一覧（#1019）。
   * 指定・非空の場合は「同一タイトル使用禁止」指示と修辞スタイル多様化指示をプロンプトに注入する。
   * 省略・空配列の場合は注入しない（後方互換）。
   */
  recentTitles?: readonly string[];
}

/** buildPostPrompt の戻り値。 */
export interface BuildPostPromptResult {
  prompt: string;
}

/**
 * post 専用の生成プロンプトを構築する（#672）。
 *
 * `buildCommunityPrompt` のコメント生成なし版。
 * - post のみを生成する（comments は空配列・replies は空配列）
 * - コミュニティの直近ログを文脈としてプロンプトに渡す
 * - 件数ヒント（postCount）に応じた枚数指示を追加する
 */
export function buildPostPrompt(params: BuildPostPromptParams): BuildPostPromptResult {
  const { community, workers, recentLog, countHints, recentTitles } = params;

  const workerLines = workers
    .map((w) => {
      const parts = [
        `  - author に指定するID（UUID）: ${w.id}`,
        `    名前（参考・author には使わない）: ${w.displayName}`,
      ];
      if (w.role) parts.push(`    役割: ${w.role}`);
      if (w.personality) parts.push(`    性格・バイブル: ${w.personality}`);
      return parts.join("\n");
    })
    .join("\n");

  const recentLogSection =
    recentLog.length > 0
      ? `直近の投稿・コメント（${recentLog.length} 件）:\n${recentLog.join("\n")}\n\n（↑ 上記で既に扱った記事・話題と重複しない新しい題材を選んでください）`
      : "直近の投稿・コメント: (なし)";

  const toneInstruction = community.generationInstruction || community.description;

  const synopsisSection = community.synopsis
    ? `コミュニティのあらすじ:\n${community.synopsis}\n\n`
    : "";

  const exampleWorkerId = workers[0]?.id ?? "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx";

  const postCountInstruction = countHints
    ? `post を ${countHints.postCount} 件生成してください（目安であり厳密な制約ではありません）`
    : "posts は 1 件以上生成してください";

  // 直近タイトルの重複回避指示（#1019）
  const recentTitlesSection =
    recentTitles && recentTitles.length > 0
      ? `\n既存タイトル（同一または酷似したタイトルは使わないでください）:\n${recentTitles.map((t) => `- ${t}`).join("\n")}\n（↑ 上記と同一タイトルの投稿は生成しないでください。また、修辞スタイル・文体・切り口が単調なパターンに収束しないよう、多様な表現形式を選んでください）`
      : "";

  const prompt = `あなたはコミュニティ "${community.name}" に所属するAIワーカーです。
以下の設定とコンテキストに基づき、このコミュニティへの**新規投稿（post）**を生成してください。

${TONE_GUIDELINES}

コミュニティ作風:
${toneInstruction}

${synopsisSection}ワーカー一覧:
${workerLines}

${recentLogSection}${recentTitlesSection}

以下のJSON形式のみで出力してください（前後の説明・コードブロック不要）:
{
  "topic": "定時のトピック概要（1文）",
  "posts": [
    {
      "id": "p1",
      "author": "UUID（上記ワーカー一覧の「author に指定するID」から選択・例: ${exampleWorkerId}）",
      "title": "投稿タイトル",
      "text": "投稿本文",
      "comments": []
    }
  ],
  "replies": []
}

注意事項:
- author には必ず上記ワーカー一覧の UUID（「author に指定するID」）を使用してください
- score フィールドは生成しないでください
- ${postCountInstruction}
- comments は必ず空配列 [] にしてください（コメントはこのバッチでは生成しません）
- replies は必ず空配列 [] にしてください
- 会話は自然で読みやすい日本語で書いてください
- 投稿本文（text フィールド）に URL（http または https から始まる文字列）を含めないこと

自己監査（出力前に必ず確認）:
- 互いを「さん付け」で呼んでいないか（トーン規約どおりフランクな呼び方になっているか）。
- 馴れ合い（中身のない同意・褒め合い）に終始せず、率直な意見が含まれているか。
- comments フィールドが [] になっているか。`;

  return { prompt };
}
