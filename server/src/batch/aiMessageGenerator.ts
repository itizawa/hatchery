import Anthropic from "@anthropic-ai/sdk";

import { DEFAULT_BATCH_MODEL, type BatchModel } from "../config/env.js";

import { logBatchError, logBatchInfo } from "./logger.js";

/**
 * チャンネル会話を生成する関数（#53）。プロンプトと API キーを受け、モデルの生テキストを返す。
 * テストではスタブを注入し、本番は Claude を使う（依存注入パターン）。
 */
export type ConversationGenerator = (prompt: string, apiKey: string) => Promise<string>;

/** チャンネルのあらすじを生成する関数（#53）。 */
export type SummaryGenerator = (prompt: string, apiKey: string) => Promise<string>;

/**
 * あらすじ生成に使う Claude モデル（#53）。
 * 会話生成のモデルは #389 AC1 で env から切替可能になったため、ここはあらすじ専用の固定値。
 */
const SUMMARY_MODEL: BatchModel = "claude-sonnet-4-6";

/** 会話生成の max_tokens（複数 post/comment の掛け合いを 1 コールで生成するため広めに取る）。 */
const CONVERSATION_MAX_TOKENS = 8192;

/** Claude にプロンプトを投げ、最初のテキストブロックを返す共通処理。 */
async function callClaudeText(
  client: Anthropic,
  prompt: string,
  model: string,
  maxTokens: number,
): Promise<string> {
  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  if (message.stop_reason === "max_tokens") {
    const snippet = prompt.length > 100 ? `${prompt.slice(0, 100)}...` : prompt;
    logBatchInfo("ai_generation.max_tokens_truncated", {
      maxTokens,
      promptSnippet: snippet,
    });
  }
  return extractFirstText(message.content);
}

/** message.content から最初のテキストブロックを取り出す（無ければ空文字）。 */
function extractFirstText(content: readonly Anthropic.Messages.ContentBlock[]): string {
  const textContent = content.find((c) => c.type === "text");
  return textContent && textContent.type === "text" ? textContent.text : "";
}

/**
 * 指定したモデルで会話 JSON を生成する ConversationGenerator を作る（#389 AC1）。
 * モデルを env から切替可能にするため、ハードコード定数ではなくファクトリで受ける。
 */
export function createClaudeConversationGenerator(model: BatchModel): ConversationGenerator {
  return (prompt, apiKey) =>
    callClaudeText(new Anthropic({ apiKey }), prompt, model, CONVERSATION_MAX_TOKENS);
}

/** Claude で会話 JSON を生成する既定実装（既定モデル sonnet-4-6・#53 / #389）。 */
export const generateConversationWithClaude: ConversationGenerator =
  createClaudeConversationGenerator(DEFAULT_BATCH_MODEL);

/** Claude であらすじを生成する既定実装（#53）。 */
export const generateSummaryWithClaude: SummaryGenerator = (prompt, apiKey) =>
  callClaudeText(new Anthropic({ apiKey }), prompt, SUMMARY_MODEL, 512);

/**
 * Batches API 経路の ConversationGenerator を作る依存（#389 AC3・DI でテスト可能にする）。
 * 実 API を叩かずにテストできるよう、Anthropic クライアント生成・待機関数を注入可能にする。
 */
export interface BatchConversationGeneratorDeps {
  /**
   * バッチ内リクエストに付与する custom_id（community を対応づける）。
   * 結果取得時にこの id に一致する succeeded を取り出す。
   */
  customId: string;
  /** 使用モデル（既定 sonnet-4-6）。 */
  model?: BatchModel;
  /** API キーから Anthropic クライアントを作る（テストでスタブ注入）。既定は new Anthropic({ apiKey })。 */
  createClient?: (apiKey: string) => Anthropic;
  /** 完了ポーリングの待機関数（テストで即時 resolve を注入）。既定は setTimeout ベース。 */
  sleep?: (ms: number) => Promise<void>;
  /** ポーリング間隔（ミリ秒）。既定 60_000。 */
  pollIntervalMs?: number;
  /** ポーリング最大回数。これを超えても ended にならなければ空文字を返す。既定 60。 */
  maxPolls?: number;
}

/** 既定の待機関数（指定ミリ秒スリープ）。 */
const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * バッチ結果の最小形（custom_id と成否）。SDK 型に依存しすぎないようローカルで narrowing する。
 * result は succeeded（message 付き）かそれ以外（errored / canceled / expired）の判別可能ユニオン。
 */
interface BatchResultLike {
  custom_id: string;
  result:
    | { type: "succeeded"; message: { content: readonly Anthropic.Messages.ContentBlock[] } }
    | { type: "errored" | "canceled" | "expired" };
}

/**
 * Message Batches API（全トークン 50% オフ）で 1 リクエストを投げ、完了までポーリングして
 * テキストを返す ConversationGenerator を作る（#389 AC3）。
 *
 * 注意（ADR-0030 / 設計書 issue-389.md）: 1 定時 = 1 コミュニティ = 1 リクエストとなったため、
 * 「複数 community を束ねる」Batches 本来の旨味は失われており、本関数は **既定経路ではなく opt-in**。
 * AC3 の要件（経路の実装 + DI でのテスト可能性）を満たすために提供する。検証・永続化は
 * runCommunityBatch 側の GenerationOutputSchema / validateGenerationOutput / slot_key 永続化を再利用する。
 */
export function createBatchConversationGenerator(
  deps: BatchConversationGeneratorDeps,
): ConversationGenerator {
  const model = deps.model ?? DEFAULT_BATCH_MODEL;
  const createClient = deps.createClient ?? ((apiKey: string) => new Anthropic({ apiKey }));
  const sleep = deps.sleep ?? defaultSleep;
  const pollIntervalMs = deps.pollIntervalMs ?? 60_000;
  const maxPolls = deps.maxPolls ?? 60;

  return async (prompt, apiKey) => {
    const client = createClient(apiKey);

    const batch = await client.messages.batches.create({
      requests: [
        {
          custom_id: deps.customId,
          params: {
            model,
            max_tokens: CONVERSATION_MAX_TOKENS,
            messages: [{ role: "user", content: prompt }],
          },
        },
      ],
    });

    // ended になるまでポーリング（最大 maxPolls 回）。
    let status: string = batch.processing_status;
    for (let i = 0; status !== "ended" && i < maxPolls; i++) {
      await sleep(pollIntervalMs);
      const polled = await client.messages.batches.retrieve(batch.id);
      status = polled.processing_status;
    }
    if (status !== "ended") {
      logBatchInfo("ai_generation.batch_not_ended", {
        batchId: batch.id,
        maxPolls,
      });
      return "";
    }

    // custom_id 一致の succeeded からテキストを取り出す。
    const results = (await client.messages.batches.results(
      batch.id,
    )) as AsyncIterable<BatchResultLike>;
    for await (const result of results) {
      if (result.custom_id !== deps.customId) continue;
      if (result.result.type === "succeeded") {
        return extractFirstText(result.result.message.content);
      }
      logBatchError(
        "ai_generation.batch_result_failed",
        `batch result type was ${result.result.type}`,
        { customId: result.custom_id, resultType: result.result.type },
      );
      return "";
    }
    return "";
  };
}
