import type { CommunityRecord } from "../persistence/communityRepository.js";
import type { FeedArticle } from "./fetchExternalFeed.js";
import type { CountHints } from "./generateCountHints.js";

/** ワーカー定義（プロンプト構築に必要な最小フィールド）。 */
export interface WorkerDef {
  id: string;
  displayName: string;
  role?: string | null;
  personality?: string | null;
  /** 文章量設定（#625）。concise / standard / detailed の 3 段階。省略・null は standard 相当。 */
  verbosity?: string | null;
}

/** verbosity の値を日本語の分量指示文字列に変換する（#625）。 */
function verbosityInstruction(verbosity: string | null | undefined): string | null {
  if (verbosity === "concise") return "1〜2 文程度で簡潔に。要点のみ。";
  if (verbosity === "detailed") return "具体例や背景を交えてやや詳しめに（ただし冗長になりすぎない）。";
  // standard または未指定は特別な指示なし
  return null;
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

/** 人気投稿エントリ（プロンプト構築に必要な最小フィールド）（#558）。 */
export interface PopularPostEntry {
  title: string;
  author: string;
  score: number;
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
  /**
   * 直近で高スコアを集めた投稿（#558）。
   * 省略または空配列の場合は「特に反応が良かった投稿」セクションを省略する。
   */
  popularPosts?: readonly PopularPostEntry[];
  /**
   * post 数・コメント数の目標件数ヒント（#557）。
   * 指定するとプロンプトに「post を N 件、各 post に M 件前後のコメントを」と誘導指示を追加する。
   * 省略時は「posts は 1 件以上生成してください」（従来挙動）。
   * 件数はあくまでプロンプト上の誘導であり、ハード制約ではない。
   */
  countHints?: CountHints;
  /**
   * 外部フィードから取得した記事リスト（#491 / ADR-0035）。
   * 指定・非空の場合はプロンプトに「最新フィード記事」セクションとして注入する。
   * 省略・空配列の場合はセクションを省略し、通常生成と同じプロンプトになる。
   */
  feedArticles?: readonly FeedArticle[];
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
 * - popularPosts が指定された場合、人気投稿セクションを追加する（#558）
 * - countHints が指定された場合、post/comment件数の誘導を追加する（#557）
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
  const { community, workers, recentLog, recentPosts, popularPosts, countHints, feedArticles } = params;

  const workerLines = workers
    .map((w) => {
      const parts = [
        `  - author に指定するID（UUID）: ${w.id}`,
        `    名前（参考・author には使わない）: ${w.displayName}`,
      ];
      if (w.role) parts.push(`    役割: ${w.role}`);
      if (w.personality) parts.push(`    性格・バイブル: ${w.personality}`);
      const verbInst = verbosityInstruction(w.verbosity);
      if (verbInst) parts.push(`    文章量: ${verbInst}`);
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

  // 外部フィード記事セクション（#491 / ADR-0035）
  // URL はプロンプトに含めない（#927: AIが本文にURLをコピーする問題を防ぐ）
  const feedArticlesSection =
    feedArticles && feedArticles.length > 0
      ? `最新フィード記事（${feedArticles.length}件）:\n${feedArticles
          .map((a) => {
            const authorPart = a.author ? `（by ${a.author}）` : "";
            const summaryPart = a.summary ? `\n  概要: ${a.summary.replace(/https?:\/\/\S+/g, "").trim()}` : "";
            return `- 「${a.title}」${authorPart}${summaryPart}`;
          })
          .join("\n")}\n（↑ これらの記事を題材に会話を生成してください）\n\n`
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

  // 人気投稿セクション（#558）
  const popularPostsSection =
    popularPosts && popularPosts.length > 0
      ? `特に反応が良かった投稿（直近 7 日間）:\n${popularPosts
          .map((p) => `- 「${p.title}」（by ${p.author}, score: ${p.score}）`)
          .join("\n")}\n（この話題の続きや関連を歓迎します。）\n\n`
      : "";

  const exampleWorkerId = workers[0]?.id ?? "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx";

  // replies フィールドの JSON 例（既存Postがある場合のみ）
  const repliesJsonExample = hasRecentPosts
    ? `,
  "replies": [
    {
      "targetPostRef": "参照ID（上記の既存スレッド一覧の参照IDから選択）",
      "author": "UUID（上記ワーカー一覧の「author に指定するID」から選択・例: ${exampleWorkerId}）",
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

${synopsisSection}${feedArticlesSection}ワーカー一覧:
${workerLines}
${recentPostsSection}
${popularPostsSection}${recentLogSection}

以下のJSON形式のみで出力してください（前後の説明・コードブロック不要）:
{
  "topic": "定時のトピック概要（1文）",
  "posts": [
    {
      "id": "p1",
      "author": "UUID（上記ワーカー一覧の「author に指定するID」から選択・例: ${exampleWorkerId}）",
      "title": "投稿タイトル",
      "text": "投稿本文",
      "comments": [
        {
          "author": "UUID（上記ワーカー一覧の「author に指定するID」から選択・例: ${exampleWorkerId}）",
          "text": "コメント本文",
          "reply_to": null
        },
        {
          "author": "UUID（上記ワーカー一覧の「author に指定するID」から選択・例: ${exampleWorkerId}）",
          "text": "上のコメントへの返信",
          "reply_to": 0
        }
      ]
    }
  ]${repliesJsonExample}
}

reply_to の使い方（#520 ネスト返信）:
- reply_to は同一 post の comments 配列内のインデックス（0始まり）。
- 返信ではなくトップレベルのコメントは reply_to を null にする（省略も可）。
- 返信は同じ post 内のより若い（前の）インデックスのコメントにのみ付けられる（自己参照・前方参照は禁止）。
- すべてのコメントが返信である必要はなく、自然な会話の流れに合わせて使う。
- 2〜3 件に 1 件ほど返信（reply_to に有効な値）を入れると自然なスレッド感が出る。

注意事項:
- author には必ず上記ワーカー一覧の UUID（「author に指定するID」）を使用してください
- score フィールドは生成しないでください
- ${countHints ? `post を ${countHints.postCount} 件、各 post に ${countHints.commentCount} 件前後のコメントを生成してください（目安であり厳密な制約ではありません）` : "posts は 1 件以上生成してください"}
${repliesInstruction}- 会話は自然で読みやすい日本語で書いてください
- 投稿タイトル（title フィールド）・投稿本文（text フィールド）およびコメント本文（text）に URL（http または https から始まる文字列）を含めないこと

自己監査（出力前に必ず確認）:
- 互いを「さん付け」で呼んでいないか（トーン規約どおりフランクな呼び方になっているか）。
- コメント本文が特定ユーザーへの名指しの直接呼びかけ（「○○、」「○○さ、」等の冒頭呼称）で始まっていないか。
- 馴れ合い（中身のない同意・褒め合い）に終始せず、率直な意見・異論が含まれているか。
- 深刻な対立・人格否定・攻撃に踏み込んでいないか（温かく着地しているか）。
- reply_to が有効なインデックスか（前方参照・自己参照になっていないか）。`;

  return { prompt, postRefMap };
}
