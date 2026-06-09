import { Octokit } from "@octokit/rest";

import type { Channel } from "@hatchery/common";

import type { AppSettingRepository } from "../persistence/appSettingRepository.js";
import type { ChannelRepository } from "../persistence/channelRepository.js";
import type { MessageRecord, MessageRepository } from "../persistence/messageRepository.js";
import { getApiKey } from "../utils/apiKey.js";

import {
  createGithubIssueCreator,
  type CreateIssueInput,
  type CreateIssueResult,
} from "./githubIssueTool.js";

export type { CreateIssueInput, CreateIssueResult };

/** 既定の使用モデル（設計書で選定・#285 / ADR-0017）。RESEARCHER_MODEL で上書き可。 */
const DEFAULT_MODEL = "claude-sonnet-4-5";
/** 1 run の最大ターン数の既定（RESEARCHER_MAX_TURNS で上書き可）。 */
const DEFAULT_MAX_TURNS = 30;
/** 1 run の予算上限 USD の既定（RESEARCHER_MAX_BUDGET_USD で上書き可）。 */
const DEFAULT_MAX_BUDGET_USD = 1.0;
/** プロンプトに載せる直近メッセージ件数。 */
const RECENT_LIMIT = 20;

/** query() スタブ/実装に渡すコンテキスト。 */
export interface RunQueryContext {
  channel: Channel;
  apiKey: string;
  /** エージェントの起票ツールが呼ぶ起票関数（dedup / 最大件数を内包）。 */
  createIssue: (input: CreateIssueInput) => Promise<CreateIssueResult>;
  /** プロダクト現状を含むプロンプト本文。 */
  prompt: string;
  model: string;
  maxTurns: number;
  maxBudgetUsd: number;
}

/** result メッセージ等を含む SDK メッセージの最小形（テスト/実装共通で扱う部分のみ）。 */
export interface SdkResultLike {
  type: string;
  subtype?: string;
  is_error?: boolean;
}

/** query() 実行関数。実装では Claude Agent SDK の query() を呼ぶ。テストではスタブする。 */
export type RunQueryFn = (ctx: RunQueryContext) => AsyncIterable<SdkResultLike>;

/** リサーチャーバッチの依存。 */
export interface RunResearcherBatchDeps {
  channelRepo: ChannelRepository;
  messageRepo: MessageRepository;
  appSettingRepo: AppSettingRepository;
  /** テスト用に注入可能な query 実行関数。省略時は Agent SDK を使う。 */
  runQuery?: RunQueryFn;
  /**
   * チャンネルごとの起票関数を生成するファクトリ（テスト用に注入可能）。
   * 省略時は Octokit ベースの createGithubIssueCreator を使う。
   */
  createIssueForChannel?: (channel: Channel) => (input: CreateIssueInput) => Promise<CreateIssueResult>;
}

/** プロダクト現状＋指示文からエージェント用プロンプトを組み立てる。 */
async function buildResearcherPrompt(
  channel: Channel,
  deps: Pick<RunResearcherBatchDeps, "messageRepo" | "channelRepo">,
): Promise<string> {
  const clientUrl = (process.env.CLIENT_URL ?? "http://localhost:5173").replace(/\/$/, "");
  const recentDesc = await deps.messageRepo.listRecentByChannel(channel.id, RECENT_LIMIT);
  const recentAsc = [...recentDesc].reverse();
  const recentLog = recentAsc.map((m) => `- ${m.text}`).join("\n") || "(直近メッセージなし)";
  const summary = await deps.channelRepo.getSummary(channel.id);

  const instructions = channel.goal.instructions
    ? `\n## チャンネルの指示\n${channel.goal.instructions}\n`
    : "";

  return [
    "あなたはプロダクトのリサーチャーです。WebSearch / WebFetch で競合・市場を調査し、",
    "自社プロダクトの現状をレビューして、改善点を GitHub Issue として起票してください。",
    `起票は提供された create_github_issue ツールのみを使い、1 run あたり最大数・重複防止はツール側で強制されます。`,
    instructions,
    `\n## 自社プロダクト URL\n${clientUrl}`,
    `\n## チャンネル「${channel.label}」のあらすじ\n${summary?.summary ?? "(あらすじなし)"}`,
    `\n## 直近のメッセージ\n${recentLog}`,
  ].join("\n");
}

/**
 * Claude Agent SDK を使う既定の query 実行関数（#285 / ADR-0017）。
 * permissionMode: "dontAsk"、allowedTools を WebSearch / WebFetch / 自前起票ツールに限定する。
 * 起票は createSdkMcpServer の in-process ツール経由で決定性を担保する。
 */
async function* runQueryWithAgentSdk(ctx: RunQueryContext): AsyncIterable<SdkResultLike> {
  // SDK は重い（query() ごとに claude サブプロセスを起動）ため遅延 import する。
  const { query, createSdkMcpServer, tool } = await import("@anthropic-ai/claude-agent-sdk");
  const { z } = await import("zod");

  const githubServer = createSdkMcpServer({
    name: "hatchery_github",
    version: "1.0.0",
    tools: [
      tool(
        "create_github_issue",
        "改善点を GitHub Issue として起票する。重複・1 run 最大件数はツール側で強制される。",
        {
          title: z.string().min(1).max(120).describe("Issue タイトル"),
          body: z.string().min(1).max(4000).describe("Issue 本文（背景・改善内容）"),
          reason: z.string().max(2000).optional().describe("提案理由"),
        },
        async (args) => {
          const result = await ctx.createIssue({ title: args.title, body: args.body, reason: args.reason });
          return {
            content: [{ type: "text", text: JSON.stringify(result) }],
          };
        },
      ),
    ],
  });

  const iterator = query({
    prompt: ctx.prompt,
    options: {
      model: ctx.model,
      permissionMode: "dontAsk",
      allowedTools: ["WebSearch", "WebFetch", "mcp__hatchery_github__create_github_issue"],
      maxTurns: ctx.maxTurns,
      maxBudgetUsd: ctx.maxBudgetUsd,
      mcpServers: { hatchery_github: githubServer },
    },
  });

  for await (const message of iterator) {
    yield message as unknown as SdkResultLike;
  }
}

/** 数値環境変数を読む（不正値・未設定は fallback）。予算は小数を許すため Number で解釈する。 */
function readNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * リサーチャー自律起票バッチ本体（#285 / ADR-0016 / ADR-0017）。
 * goal.type='issue' の全チャンネルを対象に、Claude Agent SDK のツールループで
 * 競合調査 → 現状レビュー → GitHub Issue 自律起票を行う。Express を import しない（別エントリ前提）。
 *
 * スキップ条件:
 * - ANTHROPIC_API_KEY 未設定 → 何もせず空配列。
 * - GITHUB_TOKEN / GITHUB_OWNER / GITHUB_REPO のいずれか未設定 → 起票できないため空配列。
 * - goal=issue チャンネルが無い → 空配列。
 *
 * 起票に成功（status==='created'）したら createPlanningMessage + updateIssueRef でチャンネルに残す。
 * maxTurns / maxBudgetUsd 超過の result が返ったらそのチャンネルを打ち切り、警告ログを残す（例外にしない）。
 */
export async function runResearcherBatch(deps: RunResearcherBatchDeps): Promise<MessageRecord[]> {
  const apiKey = await getApiKey(deps.appSettingRepo);
  if (!apiKey) {
    console.error("[researcherBatch] ANTHROPIC_API_KEY が設定されていないためスキップします");
    return [];
  }

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  if (!token || !owner || !repo) {
    console.error("[researcherBatch] GITHUB_TOKEN / GITHUB_OWNER / GITHUB_REPO が未設定のためスキップします");
    return [];
  }

  const allChannels = await deps.channelRepo.list();
  const issueChannels = allChannels.filter((c) => c.goal.type === "issue");
  if (issueChannels.length === 0) {
    console.error("[researcherBatch] goal=issue のチャンネルが存在しないためスキップします");
    return [];
  }

  const runQuery = deps.runQuery ?? runQueryWithAgentSdk;
  const createIssueForChannel =
    deps.createIssueForChannel ??
    (() => {
      const octokit = new Octokit({ auth: token });
      return createGithubIssueCreator({ octokit, owner, repo });
    });

  const model = process.env.RESEARCHER_MODEL ?? DEFAULT_MODEL;
  const maxTurns = readNumberEnv("RESEARCHER_MAX_TURNS", DEFAULT_MAX_TURNS);
  const maxBudgetUsd = readNumberEnv("RESEARCHER_MAX_BUDGET_USD", DEFAULT_MAX_BUDGET_USD);

  const saved: MessageRecord[] = [];

  for (const channel of issueChannels) {
    const createIssueRaw = createIssueForChannel(channel);

    // 起票成功時にメッセージを残すため、createIssue をラップして結果を蓄積する。
    const pendingMessages: { input: CreateIssueInput; result: CreateIssueResult }[] = [];
    const createIssue = async (input: CreateIssueInput): Promise<CreateIssueResult> => {
      const result = await createIssueRaw(input);
      pendingMessages.push({ input, result });
      return result;
    };

    try {
      const prompt = await buildResearcherPrompt(channel, deps);
      const iterator = runQuery({
        channel,
        apiKey,
        createIssue,
        prompt,
        model,
        maxTurns,
        maxBudgetUsd,
      });

      for await (const message of iterator) {
        if (
          message.type === "result" &&
          (message.subtype === "error_max_turns" || message.subtype === "error_max_budget_usd")
        ) {
          console.warn(
            `[researcherBatch] チャンネル ${channel.id} が ${message.subtype} で打ち切られました`,
          );
        }
      }
    } catch (err) {
      console.error(`[researcherBatch] チャンネル ${channel.id} のリサーチに失敗しました:`, err);
    }

    // 起票に成功した提案だけをチャンネルメッセージとして残す（duplicate/limit_reached は残さない）。
    for (const { input, result } of pendingMessages) {
      if (result.status !== "created") continue;
      try {
        const record = await deps.messageRepo.createPlanningMessage({
          createdEmployeeId: "ai-researcher",
          channel: channel.id,
          text: `【改善起票】${input.title}`,
          proposalTitle: input.title,
          proposalReason: input.reason ?? input.body,
          proposalTargetUrl: "",
        });
        const updated = await deps.messageRepo.updateIssueRef(
          record.id,
          result.issueNumber,
          result.issueUrl,
        );
        saved.push(updated ?? record);
      } catch (err) {
        console.error(`[researcherBatch] メッセージ保存に失敗しました (channel=${channel.id}):`, err);
      }
    }
  }

  return saved;
}
