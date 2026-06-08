import Anthropic from "@anthropic-ai/sdk";
import * as cheerio from "cheerio";

import type { AppSettingRepository } from "../persistence/appSettingRepository.js";
import type { ChannelRepository } from "../persistence/channelRepository.js";
import type { MessageRecord, MessageRepository } from "../persistence/messageRepository.js";
import type { TokenUsageLogRepository } from "../persistence/tokenUsageLogRepository.js";
import { getApiKey } from "../utils/apiKey.js";

/** UX 提案の構造体（#76）。 */
export interface UxProposal {
  title: string;
  reason: string;
  targetUrl: string;
}

/** トークン使用量の情報（#153）。 */
export interface TokenUsageInfo {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/** generateProposalsWithUsage の戻り値（提案 + 使用量）。 */
export interface ProposalsWithUsage {
  proposals: UxProposal[];
  usage: TokenUsageInfo | null;
}

/** 企画 チャンネルの ID（DEFAULT_CHANNELS の kikaku エントリと一致）。 */
const PLANNING_CHANNEL_ID = "kikaku";

/** バッチが巡回するデフォルトパス一覧。 */
const DEFAULT_PATHS = ["/", "/login", "/channels/zatsudan", "/channels/shigoto"];

/** MAX 提案数（1 バッチで保存する上限）。 */
const MAX_PROPOSALS = 3;

export interface RunPlanningBatchDeps {
  channelRepo: ChannelRepository;
  messageRepo: MessageRepository;
  appSettingRepo: AppSettingRepository;
  /** トークン使用量ログの永続化。省略時は記録しない（#153）。 */
  tokenUsageLogRepository?: TokenUsageLogRepository;
  /**
   * テスト用に注入可能な提案生成関数（提案のみ返す・後方互換）。
   * 省略かつ generateProposalsWithUsage も省略時は実際の Claude API を使う。
   * generateProposals を指定した場合は generateProposalsWithUsage より優先される。
   */
  generateProposals?: (pageContents: Record<string, string>, apiKey: string) => Promise<UxProposal[]>;
  /**
   * テスト用に注入可能な提案生成関数（提案 + 使用量を返す・#153）。
   * generateProposals が未指定の場合に使われる。
   */
  generateProposalsWithUsage?: (pageContents: Record<string, string>, apiKey: string) => Promise<ProposalsWithUsage>;
}

/**
 * HTML からテキストコンテンツを抽出する。
 * SPA（JS 未評価）のため静的 HTML のみ対象とし、スクリプト・スタイルを除いたテキストを返す。
 */
function extractTextFromHtml(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  return $("body").text().replace(/\s+/g, " ").trim().slice(0, 2000);
}

/** Claude API を使って UX 提案と使用量を生成する（デフォルト実装・#153）。 */
async function generateProposalsWithClaude(
  pageContents: Record<string, string>,
  apiKey: string,
): Promise<ProposalsWithUsage> {
  const client = new Anthropic({ apiKey });
  const modelName = "claude-haiku-4-5";

  const pagesDescription = Object.entries(pageContents)
    .map(([url, content]) => `[${url}]\n${content || "(コンテンツ取得不可)"}}`)
    .join("\n\n");

  const prompt = `あなたは UX の専門家です。以下のウェブアプリのページコンテンツを分析し、UX 改善点を最大 ${MAX_PROPOSALS} 件提案してください。\n\nページコンテンツ:\n${pagesDescription}\n\n以下の JSON 配列形式で返答してください（それ以外のテキストは含めないでください）:\n[\n  {\n    "title": "改善提案のタイトル（50文字以内）",\n    "reason": "改善理由と具体的な改善方法（200文字以内）",\n    "targetUrl": "対象ページのURL"\n  }\n]`;

  const message = await client.messages.create({
    model: modelName,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const usage: TokenUsageInfo = {
    model: modelName,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };

  const textContent = message.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    return { proposals: [], usage };
  }

  try {
    const parsed: unknown = JSON.parse(textContent.text);
    if (!Array.isArray(parsed)) return { proposals: [], usage };
    const proposals = parsed
      .filter(
        (item): item is UxProposal =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as UxProposal).title === "string" &&
          typeof (item as UxProposal).reason === "string" &&
          typeof (item as UxProposal).targetUrl === "string",
      )
      .slice(0, MAX_PROPOSALS);
    return { proposals, usage };
  } catch {
    return { proposals: [], usage };
  }
}

/**
 * UX 提案バッチ本体（#76）。
 * - ANTHROPIC_API_KEY が未設定ならスキップ
 * - 企画 チャンネルが存在しなければスキップ
 * - CLIENT_URL のページを巡回して UX 提案を生成し、企画 チャンネルへ保存する
 * - API 呼び出しのトークン使用量を tokenUsageLogRepository に記録する（#153）
 */
export async function runPlanningBatch(deps: RunPlanningBatchDeps): Promise<MessageRecord[]> {
  const apiKey = await getApiKey(deps.appSettingRepo);
  if (!apiKey) {
    console.error("[planningBatch] ANTHROPIC_API_KEY が設定されていないためスキップします");
    return [];
  }

  const channel = await deps.channelRepo.findById(PLANNING_CHANNEL_ID);
  if (!channel) {
    console.error(`[planningBatch] 企画 チャンネル (${PLANNING_CHANNEL_ID}) が存在しないためスキップします`);
    return [];
  }

  const clientUrl = (process.env.CLIENT_URL ?? "http://localhost:5173").replace(/\/$/,  "");

  const fetchPage = async (path: string): Promise<string> => {
    try {
      const res = await fetch(`${clientUrl}${path}`);
      if (res.ok) {
        const html = await res.text();
        return extractTextFromHtml(html);
      }
    } catch {
      // ページ取得失敗は空文字で続行
    }
    return "";
  };

  const contents = await Promise.all(DEFAULT_PATHS.map(fetchPage));
  const pageContents: Record<string, string> = Object.fromEntries(
    DEFAULT_PATHS.map((path, i): [string, string] => [path, contents[i] ?? ""]),
  );

  let proposals: UxProposal[];
  let usage: TokenUsageInfo | null = null;

  // 後方互換: generateProposals が指定された場合はそちらを使う（usage は記録しない）
  if (deps.generateProposals) {
    try {
      proposals = await deps.generateProposals(pageContents, apiKey);
    } catch (err) {
      console.error("[planningBatch] 提案生成中にエラーが発生しました:", err);
      return [];
    }
  } else {
    // generateProposalsWithUsage（注入またはデフォルトの Claude API 呼び出し）を使う
    const generate = deps.generateProposalsWithUsage ?? generateProposalsWithClaude;
    let result: ProposalsWithUsage;
    try {
      result = await generate(pageContents, apiKey);
    } catch (err) {
      console.error("[planningBatch] 提案生成中にエラーが発生しました:", err);
      return [];
    }
    proposals = result.proposals;
    usage = result.usage;

    // トークン使用量を記録する（#153）
    if (usage && deps.tokenUsageLogRepository) {
      try {
        await deps.tokenUsageLogRepository.create({
          model: usage.model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          batchRunLogId: null,
        });
      } catch (err) {
        // 使用量記録の失敗はバッチ全体の失敗にしない
        console.error("[planningBatch] トークン使用量の記録に失敗しました:", err);
      }
    }
  }

  if (proposals.length === 0) {
    return [];
  }

  const saved: MessageRecord[] = [];
  for (const proposal of proposals) {
    const record = await deps.messageRepo.createPlanningMessage({
      createdEmployeeId: "ai-planner",
      channel: PLANNING_CHANNEL_ID,
      text: `【UX提案】${proposal.title}`,
      proposalTitle: proposal.title,
      proposalReason: proposal.reason,
      proposalTargetUrl: proposal.targetUrl,
    });
    saved.push(record);
  }

  return saved;
}
