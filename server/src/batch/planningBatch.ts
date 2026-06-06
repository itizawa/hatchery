import Anthropic from "@anthropic-ai/sdk";
import * as cheerio from "cheerio";

import type { AppSettingRepository } from "../persistence/appSettingRepository.js";
import type { ChannelRepository } from "../persistence/channelRepository.js";
import type { MessageRecord, MessageRepository } from "../persistence/messageRepository.js";
import { getApiKey } from "../utils/apiKey.js";

/** UX 提案の構造体（#76）。 */
export interface UxProposal {
  title: string;
  reason: string;
  targetUrl: string;
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
  /** テスト用に注入可能な提案生成関数。省略時は Claude API を使う。 */
  generateProposals?: (pageContents: Record<string, string>, apiKey: string) => Promise<UxProposal[]>;
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

/** Claude API を使って UX 提案を生成する（デフォルト実装）。 */
async function generateProposalsWithClaude(
  pageContents: Record<string, string>,
  apiKey: string,
): Promise<UxProposal[]> {
  const client = new Anthropic({ apiKey });

  const pagesDescription = Object.entries(pageContents)
    .map(([url, content]) => `[${url}]\n${content || "(コンテンツ取得不可)"}}`)
    .join("\n\n");

  const prompt = `あなたは UX の専門家です。以下のウェブアプリのページコンテンツを分析し、UX 改善点を最大 ${MAX_PROPOSALS} 件提案してください。

ページコンテンツ:
${pagesDescription}

以下の JSON 配列形式で返答してください（それ以外のテキストは含めないでください）:
[
  {
    "title": "改善提案のタイトル（50文字以内）",
    "reason": "改善理由と具体的な改善方法（200文字以内）",
    "targetUrl": "対象ページのURL"
  }
]`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const textContent = message.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(textContent.text);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is UxProposal =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as UxProposal).title === "string" &&
          typeof (item as UxProposal).reason === "string" &&
          typeof (item as UxProposal).targetUrl === "string",
      )
      .slice(0, MAX_PROPOSALS);
  } catch {
    return [];
  }
}

/**
 * UX 提案バッチ本体（#76）。
 * - ANTHROPIC_API_KEY が未設定ならスキップ
 * - 企画 チャンネルが存在しなければスキップ
 * - CLIENT_URL のページを巡回して UX 提案を生成し、企画 チャンネルへ保存する
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

  const generate = deps.generateProposals ?? generateProposalsWithClaude;
  let proposals: UxProposal[];
  try {
    proposals = await generate(pageContents, apiKey);
  } catch (err) {
    console.error("[planningBatch] 提案生成中にエラーが発生しました:", err);
    return [];
  }

  if (proposals.length === 0) {
    return [];
  }

  const saved: MessageRecord[] = [];
  for (const proposal of proposals) {
    const record = await deps.messageRepo.createPlanningMessage({
      speaker: "ai-planner",
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
