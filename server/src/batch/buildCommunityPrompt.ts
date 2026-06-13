import type { CommunityRecord } from "../persistence/communityRepository.js";

/** ワーカー定義（プロンプト構築に必要な最小フィールド）。 */
export interface WorkerDef {
  id: string;
  displayName: string;
  role?: string | null;
  personality?: string | null;
}

/** buildCommunityPrompt のパラメータ。 */
export interface BuildCommunityPromptParams {
  community: CommunityRecord;
  workers: readonly WorkerDef[];
  recentLog: readonly string[];
}

/**
 * トーン規約（共通エンジン部 = 脚本ルール層・#487 / concept.md「共通エンジン部」）。
 *
 * 全 community 共通で常に注入する。community 固有の作風（description）はこの後段に置かれ、
 * 題材・世界観を上書きできるが、トーン規約（呼称・距離感・ガードレール）は既定として常に効く。
 *
 * 狙いは「さん付け・馴れ合いに流れる丁寧な会話」を、日本のネットコミュニティ（個人開発界隈）の
 * ようなフランクで率直な距離感に寄せること。ただし ADR-0023 / concept のガードレールを厳守し、
 * 深刻な対立・人格否定・攻撃には踏み込まない（成長メカニクス等は一切導入しない）。
 */
export const TONE_GUIDELINES = `## トーン規約（このコミュニティの全会話に共通）
- 呼称: 互いを「さん付け」で呼ばない。ハンドルネームや呼び捨て基調のフランクな呼び方にする。
- 距離感: 過度な敬語・社交辞令・馴れ合い（中身のない同意・褒め合い）を避ける。率直な意見・異論・軽いツッコミを歓迎する。タメ口・くだけた口調でよい。
- ただし、これはあくまでフランクで率直なネットコミュニティの距離感を出すためであり、深刻な対立・人格否定・攻撃はしない。
- 失敗やハプニング・意見の食い違いは、最後は温かく着地させ深刻化させない。全員が常に気の利いたことを言う必要はなく、生返事・雑談も歓迎。`;

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

${TONE_GUIDELINES}

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
- 会話は自然で読みやすい日本語で書いてください

自己監査（出力前に必ず確認）:
- 互いを「さん付け」で呼んでいないか（トーン規約どおりフランクな呼び方になっているか）。
- 馴れ合い（中身のない同意・褒め合い）に終始せず、率直な意見・異論が含まれているか。
- 深刻な対立・人格否定・攻撃に踏み込んでいないか（温かく着地しているか）。`;
}
