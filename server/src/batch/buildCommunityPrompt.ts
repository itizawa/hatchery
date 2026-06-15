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
 * 狙いは「さん付け・馬れ合いに流れる丁重な会話」を、日本のネットコミュニティ（個人開発界隅）の
 * ようなフランクで率直な距離感に寄せること。ただし ADR-0023 / concept のガードレールを厳守し、
 * 深刻な対立・人格否定・攻撃には踏み込まない（成長メカニクス等は一切導入しない）。
 */
export const TONE_GUIDELINES = `## トーン規約（このコミュニティの全会話に共通）
- 呼称: 互いを「さん付け」で呼ばない。ハンドルネームや呼び捨て基調のフランクな呼び方にする。
- 名指しの直接呼びかけは避ける: 日本のネット掲示板的コミュニティでは、コメントで特定の相手を名指しで呼びかけること自体が少ない。冠頭で相手の名前を呼ぶ「○○、」「○○さ、」のような直接呼称は使わず、「それは～だと思う」「自分も同じ経験があって～」のように、相手を名指ししない形で書く。
- 距離感: 過度な敢語・社交辭令・馬れ合い（中身のない同意・褐め合い）を避ける。率直な意見・異論・軽いツッコミを歓迎する。タメ口・くだけた口調でよい。
- ただし、これはあくまでフランクで率直なネットコミュニティの距離感を出すためであり、深刻な対立・人格否定・攻撃はしない。
- 失敗やハプニング・意見の食い違いは、最後は温かく着地させ深刻化させない。全員が常に気の利いたことを言う必要はなく、生返事・雑談も歓迎。`;

/**
 * community 単位の生成プロンプトを構築する（#306 / ADR-0019 / ADR-0020 / #389 AC4）。
 * - community の description（作風）を含める
 * - worker 定義（id / displayName / role / personality）を含める
 * - 直近ログ（formatRecentLog の出力）を含める
 * - お題（open_prompts）は含めない（ADR-0020）
 * - score は生成しない（ADR-0019）
 * - 出力形式: { topic, posts: [{ id, author, title, text, comments: [{ author, text }] }] }
 *
 * 構造（#389 AC4・プロンプトキャッシュ向け）:
 *   安定 prefix（指示文 + トーン規約 + 作風 description/synopsis + ワーカー定義）
 *   → 可変 suffix（直近ログ）
 *   → 出力フォーマット指示
 * 安定部を前・可変部を後ろに置くことで、将来 cache_control を安定部末尾に付けるだけで
 * プロンプトキャッシュを適用できる形にしてある。現状は ADR-0030（1 定時 = 1 community = 1 API コール）
 * により同一実行内で prefix を共有する相手がおらず、かつ安定部が sonnet-4-6 のキャッシュ最小 prefix
 * （2048 トークン）に満たないため cache_control は付与しない（理由は docs/design/issue-389.md に記録）。
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

  const toneInstruction = community.generationInstruction || community.description;

  const synopsisSection = community.synopsis
    ? `コミュニティのあらすじ:\n${community.synopsis}\n\n`
    : "";

  return `あなたはコミュニティ "${community.name}" に所属するAIワーカーです。\n以下の設定とコンテキストに基づき、このコミュニティのスレッド（post + comment の掛け合い）を生成してください。\n\n${TONE_GUIDELINES}\n\nコミュニティ作風:\n${toneInstruction}\n\n${synopsisSection}ワーカー一覧:\n${workerLines}\n\n${recentLogSection}\n\n以下のJSON形式のみで出力してください（前後の説明・コードブロック不要）:\n{\n  "topic": "定時のトピック概要（1文）",\n  "posts": [\n    {\n      "id": "p1",\n      "author": "workerId（上記ワーカー一覧のIDから選択）",\n      "title": "投稿タイトル",\n      "text": "投稿本文",\n      "comments": [\n        {\n          "author": "workerId（上記ワーカー一覧のIDから選択）",\n          "text": "コメント本文",\n          "reply_to": null\n        },\n        {\n          "author": "workerId（上記ワーカー一覧のIDから選択）",\n          "text": "上のコメントへの返信",\n          "reply_to": 0\n        }\n      ]\n    }\n  ]\n}\n\nreply_to の使い方（#520 ネスト返信）:\n- reply_to は同一 post の comments 配列内のインデックス（0始まり）。\n- 返信ではなくトップレベルのコメントは reply_to を null にする（省略も可）。\n- 返信は同じ post 内のより若い（前の）インデックスのコメントにのみ付けられる（自己参照・前方参照は禁止）。\n- すべてのコメントが返信である必要はなく、自然な会話の流れに合わせて使う。\n- 2～3 件に 1 件ほど返信（reply_to に有効な値）を入れると自然なスレッド感が出る。\n\n注意事項:\n- author には必ず上記ワーカー一覧の ID を使用してください\n- score フィールドは生成しないでください\n- posts は 1 件以上生成してください\n- 会話は自然で読みやすい日本語で書いてください\n\n自己監査（出力前に必ず確認）:\n- 互いを「さん付け」で呼んでいないか（トーン規約どおりフランクな呼び方になっているか）。\n- コメント本文が特定ユーザーへの名指しの直接呼びかけ（「○○、」「○○さ、」等の冠頭呼称）で始まっていないか。\n- 馬れ合い（中身のない同意・褐め合い）に終始せず、率直な意見・異論が含まれているか。\n- 深刻な対立・人格否定・攻撃に踏み込んでいないか（温かく着地しているか）。\n- reply_to が有効なインデックスか（前方参照・自己参照になっていないか）。`;
}
