import type { CommunityRecord } from "../persistence/communityRepository.js";

/** ワーカー定義（プロンプト構築に必要な最小フィールド）。 */
export interface WorkerDef {
  id: string;
  displayName: string;
  role?: string | null;
  personality?: string | null;
}

/** 既存Post参照定義（プロンプトに露出する安定参照ID + 実postId マッピング用）。#555 */
export interface RecentPostRef {
  /** プロンプトに露出する安定参照ID（"ref-1" 等）。 */
  ref: string;
  /** 実際の postId（UUID）。永続化時の解決に使う。 */
  id: string;
  /** 投稿タイトル。AIモデルが内容を把握するためにプロンプトに含める。 */
  title: string;
}

/** buildCommunityPrompt のパラメータ。 */
export interface BuildCommunityPromptParams {
  community: CommunityRecord;
  workers: readonly WorkerDef[];
  recentLog: readonly string[];
  /**
   * プロンプトに露出する直近Post参照リスト（#555）。
   * 省略時・空時は既存Postへの返信指示を含めない。
   */
  recentPosts?: readonly RecentPostRef[];
}

/** buildCommunityPrompt の戻り値。#555 */
export interface BuildCommunityPromptResult {
  /** 生成プロンプト文字列。 */
  prompt: string;
  /** 参照ID（"ref-1" 等）→ 実postId のマッピング。recentPosts が空のときは空 Map。 */
  postRefMap: Map<string, string>;
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
- 名指しの直接呼びかけは避ける: 日本のネット掲示板的コミュニティでは、コメントで特定の相手を名指しで呼びかけること自体が少ない。冒頭で相手の名前を呼ぶ「○○、」「○○さ、」のような直接呼称は使わず、「それは〜だと思う」「自分も同じ経験があって〜」のように、相手を名指ししない形で書く。
- 距離感: 過度な敬語・社交辞令・馴れ合い（中身のない同意・褒め合い）を避ける。率直な意見・異論・軽いツッコミを歓迎する。タメ口・くだけた口調でよい。
- ただし、これはあくまでフランクで率直なネットコミュニティの距離感を出すためであり、深刻な対立・人格否定・攻撃はしない。
- 失敗やハプニング・意見の食い違いは、最後は温かく着地させ深刻化させない。全員が常に気の利いたことを言う必要はなく、生返事・雑談も歓迎。`;

/**
 * community 単位の生成プロンプトを構築する（#306 / ADR-0019 / ADR-0020 / #389 AC4 / #555）。
 * - community の description（作風）を含める
 * - worker 定義（id / displayName / role / personality）を含める
 * - 直近ログ（formatRecentLog の出力）を含める
 * - recentPosts が指定された場合、既存Postへの参照IDとタイトルを含め返信指示を追加する（#555）
 * - お題（open_prompts）は含めない（ADR-0020）
 * - score は生成しない（ADR-0019）
 * - 出力形式: { topic, posts: [...], replies: [...] }（#555）
 *
 * 戻り値: { prompt: string, postRefMap: Map<string, string> }（#555）
 * - postRefMap は 参照ID（"ref-1" 等）→ 実postId のマッピング
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
export function buildCommunityPrompt(
  params: BuildCommunityPromptParams,
): BuildCommunityPromptResult {
  const { community, workers, recentLog, recentPosts } = params;

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

  // 既存Post参照マップを構築（#555）
  const postRefMap = new Map<string, string>();
  const hasRecentPosts = recentPosts && recentPosts.length > 0;

  if (hasRecentPosts) {
    for (const p of recentPosts) {
      postRefMap.set(p.ref, p.id);
    }
  }

  // 既存Post参照セクション（#555）
  const recentPostsSection = hasRecentPosts
    ? `\n既存スレッド一覧（過去の投稿・これらにコメントを追加することもできます）:\n${recentPosts.map((p) => `  - 参照ID: ${p.ref}  タイトル: ${p.title}`).join("\n")}\n`
    : "";

  // replies フィールドの JSON 例（既存Postがある場合のみ）
  const repliesJsonExample = hasRecentPosts
    ? `,
  "replies": [
    {
      "targetPostRef": "参照ID（上記の既存スレッド一覧の参照IDから選択）",
      "author": "workerId（上記ワーカー一覧のIDから選択）",
      "text": "コメント本文"
    }
  ]`
    : `,
  "replies": []`;

  // replies の注意事項（既存Postがある場合のみ）
  const repliesInstruction = hasRecentPosts
    ? `- replies には既存スレッドへのコメントを含めることができます（省略可・既存スレッドがあれば積極的に活用してください）
- replies の targetPostRef には必ず上記「既存スレッド一覧」の参照IDを使用してください
`
    : `- replies は空配列のままにしてください（既存スレッドがありません）
`;

  const prompt = `あなたはコミュニティ "${community.name}" に所属するAIワーカーです。
以下の設定とコンテキストに基づき、このコミュニティのスレッド（post + comment の掛け合い）を生成してください。

${TONE_GUIDELINES}

コミュニティ作風:
${toneInstruction}

${synopsisSection}ワーカー一覧:
${workerLines}
${recentPostsSection}
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
  ]${repliesJsonExample}
}

注意事項:
- author には必ず上記ワーカー一覧の ID を使用してください
- score フィールドは生成しないでください
- posts は 1 件以上生成してください
${repliesInstruction}
- 会話は自然で読みやすい日本語で書いてください

自己監査（出力前に必ず確認）:
- 互いを「さん付け」で呼んでいないか（トーン規約どおりフランクな呼び方になっているか）。
- コメント本文が特定ユーザーへの名指しの直接呼びかけ（「○○、」「○○さ、」等の冒頭呼称）で始まっていないか。
- 馴れ合い（中身のない同意・褒め合い）に終始せず、率直な意見・異論が含まれているか。
- 深刻な対立・人格否定・攻撃に踏み込んでいないか（温かく着地しているか）。`;

  return { prompt, postRefMap };
}
