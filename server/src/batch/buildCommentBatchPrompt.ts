import type { CommunityRecord } from "../persistence/communityRepository.js";
import type { WorkerDef } from "./buildCommunityPrompt.js";
import { TONE_GUIDELINES } from "./buildCommunityPrompt.js";

/** コメントバッチのプロンプトに渡す対象 post の定義（#673）。 */
export interface TargetPostForComment {
  /** プロンプトに露出する安定参照ID（"ref-1" 等）。 */
  ref: string;
  /** 実際の postId（UUID）。postRefMap の構築に使う。 */
  id: string;
  title: string;
  text: string;
  /** この post に付けるコメントの目標件数。 */
  commentCount: number;
  /** 既存コメント（文脈提供のためプロンプトに含める）。 */
  existingComments: Array<{ author: string; text: string }>;
}

/** buildCommentBatchPrompt の戻り値。 */
export interface BuildCommentBatchPromptResult {
  prompt: string;
  /** ref → postId のマッピング（永続化時に ref を実際の postId へ解決する）。 */
  postRefMap: Map<string, string>;
}

/**
 * comment バッチ専用プロンプトを構築する（#673）。
 * 既存 post への comment 追加を促すプロンプトを生成し、postRefMap も返す。
 */
export function buildCommentBatchPrompt(params: {
  community: CommunityRecord;
  workers: readonly WorkerDef[];
  recentLog: readonly string[];
  targetPosts: readonly TargetPostForComment[];
}): BuildCommentBatchPromptResult {
  const { community, workers, recentLog, targetPosts } = params;

  const postRefMap = new Map<string, string>();
  for (const post of targetPosts) {
    postRefMap.set(post.ref, post.id);
  }

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
      ? `直近の投稿・コメント（${recentLog.length} 件）:\n${recentLog.join("\n")}`
      : "直近の投稿・コメント: (なし)";

  const toneInstruction = community.generationInstruction || community.description;

  const synopsisSection = community.synopsis
    ? `コミュニティのあらすじ:\n${community.synopsis}\n\n`
    : "";

  const exampleWorkerId = workers[0]?.id ?? "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx";

  const postLines = targetPosts
    .map((post) => {
      const existingSection =
        post.existingComments.length > 0
          ? `\n  既存コメント:\n${post.existingComments.map((c) => `    - ${c.author}: ${c.text}`).join("\n")}`
          : "";
      return `  ref: ${post.ref}\n  title: ${post.title}\n  text: ${post.text}\n  コメント目標件数: ${post.commentCount} 件${existingSection}`;
    })
    .join("\n\n");

  const prompt = `あなたはコミュニティ "${community.name}" に所属するAIワーカーです。
以下の設定とコンテキストに基づき、既存の投稿（post）へのコメントを生成してください。

${TONE_GUIDELINES}

コミュニティ作風:
${toneInstruction}

${synopsisSection}ワーカー一覧:
${workerLines}

${recentLogSection}

コメント対象の投稿一覧:
${postLines}

以下のJSON形式のみで出力してください（前後の説明・コードブロック不要）:
{
  "topic": "このバッチのトピック概要（1文）",
  "posts": [
    {
      "ref": "ref-1",
      "comments": [
        {
          "author": "UUID（上記ワーカー一覧の「author に指定するID」から選択・例: ${exampleWorkerId}）",
          "text": "コメント本文",
          "reply_to": null
        }
      ]
    }
  ]
}

注意事項:
- author には必ず上記ワーカー一覧の UUID（「author に指定するID」）を使用してください
- score フィールドは生成しないでください
- 各 post の「コメント目標件数」を目安にコメントを生成してください
- reply_to は同じ post 内コメントの 0 始まりインデックスを指定（返信でない場合は null）
- 会話は自然で読みやすい日本語で書いてください

自己監査（出力前に必ず確認）:
- 互いを「さん付け」で呼んでいないか（トーン規約どおりフランクな呼び方になっているか）。
- 馴れ合い（中身のない同意・褒め合い）に終始せず、率直な意見が含まれているか。
- ref に対応する post のコメントのみを生成しているか。`;

  return { prompt, postRefMap };
}
