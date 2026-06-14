import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@anthropic-ai/sdk");

import Anthropic from "@anthropic-ai/sdk";
import {
  createBatchConversationGenerator,
  createClaudeConversationGenerator,
  generateConversationWithClaude,
  generateSummaryWithClaude,
} from "./aiMessageGenerator.js";

const MockedAnthropic = vi.mocked(Anthropic);

const makeMessage = (stopReason: string, text = "{}") => ({
  id: "msg_test",
  type: "message",
  role: "assistant",
  content: [{ type: "text", text }],
  model: "claude-sonnet-4-6",
  stop_reason: stopReason,
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 20 },
});

describe("aiMessageGenerator (#401)", () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockCreate = vi.fn();
    MockedAnthropic.mockImplementation(
      () => ({ messages: { create: mockCreate } }) as unknown as Anthropic,
    );
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("generateConversationWithClaude", () => {
    it("messages.create を max_tokens: 4096 以上で呼ぶ", async () => {
      mockCreate.mockResolvedValue(makeMessage("end_turn", '{"topic":"test","posts":[]}'));

      await generateConversationWithClaude("test prompt", "api-key");

      expect(mockCreate).toHaveBeenCalledOnce();
      const callArgs = mockCreate.mock.calls[0][0] as { max_tokens: number };
      expect(callArgs.max_tokens).toBeGreaterThanOrEqual(4096);
    });

    it("stop_reason が 'max_tokens' のとき構造化ログ（console.log）を出す", async () => {
      mockCreate.mockResolvedValue(makeMessage("max_tokens", '{"topic":"test","po'));

      await generateConversationWithClaude("community: テクノロジー テストプロンプト", "api-key");

      expect(console.log).toHaveBeenCalledOnce();
      const logArg = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(logArg) as Record<string, unknown>;
      expect(parsed.level).toBe("info");
      expect(parsed.event).toBe("ai_generation.max_tokens_truncated");
    });

    it("stop_reason が 'end_turn' のとき構造化ログを出さない", async () => {
      mockCreate.mockResolvedValue(makeMessage("end_turn", '{"topic":"test","posts":[]}'));

      await generateConversationWithClaude("test prompt", "api-key");

      expect(console.log).not.toHaveBeenCalled();
    });

    it("stop_reason が 'max_tokens' でもスローせずテキストを返す", async () => {
      const truncatedText = '{"topic":"test","po';
      mockCreate.mockResolvedValue(makeMessage("max_tokens", truncatedText));

      const result = await generateConversationWithClaude("test prompt", "api-key");

      expect(result).toBe(truncatedText);
    });

    it("生成されたテキストを返す", async () => {
      const expected = '{"topic":"test","posts":[]}';
      mockCreate.mockResolvedValue(makeMessage("end_turn", expected));

      const result = await generateConversationWithClaude("test prompt", "api-key");

      expect(result).toBe(expected);
    });
  });

  describe("generateSummaryWithClaude", () => {
    it("messages.create を max_tokens: 512 で呼ぶ（スコープ外・変更なし）", async () => {
      mockCreate.mockResolvedValue(makeMessage("end_turn", "summary text"));

      await generateSummaryWithClaude("test prompt", "api-key");

      expect(mockCreate).toHaveBeenCalledOnce();
      const callArgs = mockCreate.mock.calls[0][0] as { max_tokens: number };
      expect(callArgs.max_tokens).toBe(512);
    });
  });

  // --- createClaudeConversationGenerator（#389 AC1: モデル選定の設定化） ---
  describe("createClaudeConversationGenerator", () => {
    it("既定（generateConversationWithClaude）は model: claude-sonnet-4-6 で呼ぶ", async () => {
      mockCreate.mockResolvedValue(makeMessage("end_turn", '{"topic":"t","posts":[]}'));

      await generateConversationWithClaude("p", "api-key");

      const callArgs = mockCreate.mock.calls[0][0] as { model: string };
      expect(callArgs.model).toBe("claude-sonnet-4-6");
    });

    it("指定したモデルで messages.create を呼ぶ（claude-haiku-4-5）", async () => {
      mockCreate.mockResolvedValue(makeMessage("end_turn", '{"topic":"t","posts":[]}'));

      const generate = createClaudeConversationGenerator("claude-haiku-4-5");
      await generate("p", "api-key");

      const callArgs = mockCreate.mock.calls[0][0] as { model: string; max_tokens: number };
      expect(callArgs.model).toBe("claude-haiku-4-5");
      // 会話生成の max_tokens は従来どおり 4096 以上を維持
      expect(callArgs.max_tokens).toBeGreaterThanOrEqual(4096);
    });

    it("生成テキストを返す", async () => {
      const expected = '{"topic":"t","posts":[]}';
      mockCreate.mockResolvedValue(makeMessage("end_turn", expected));

      const generate = createClaudeConversationGenerator("claude-haiku-4-5");
      const result = await generate("p", "api-key");

      expect(result).toBe(expected);
    });
  });

  // --- createBatchConversationGenerator（#389 AC3: Batches API 経路・DI でテスト可能） ---
  describe("createBatchConversationGenerator", () => {
    const expectedText = '{"topic":"batch","posts":[]}';

    /** Batches API のスタブクライアントを組み立てる（実 API を叩かない）。 */
    const buildBatchClient = (opts: {
      status?: string[];
      results?: Array<{
        custom_id: string;
        result:
          | { type: "succeeded"; message: { content: Array<{ type: string; text?: string }> } }
          | { type: "errored"; error: { type: string } };
      }>;
    }) => {
      const statuses = opts.status ?? ["ended"];
      let retrieveCount = 0;
      const create = vi.fn().mockResolvedValue({ id: "batch_1", processing_status: statuses[0] });
      const retrieve = vi.fn().mockImplementation(() => {
        const status = statuses[Math.min(retrieveCount, statuses.length - 1)];
        retrieveCount++;
        return Promise.resolve({ id: "batch_1", processing_status: status });
      });
      // results は async iterable を返す
      const results = vi.fn().mockImplementation(() => {
        const data = opts.results ?? [];
        return Promise.resolve({
          async *[Symbol.asyncIterator]() {
            for (const r of data) yield r;
          },
        });
      });
      const client = {
        messages: { batches: { create, retrieve, results } },
      } as unknown as Anthropic;
      return { client, create, retrieve, results };
    };

    it("create→ポーリング→results からテキストを返す（custom_id 指定）", async () => {
      const { client, create, retrieve, results } = buildBatchClient({
        status: ["in_progress", "ended"],
        results: [
          {
            custom_id: "community-1",
            result: { type: "succeeded", message: { content: [{ type: "text", text: expectedText }] } },
          },
        ],
      });
      const sleep = vi.fn().mockResolvedValue(undefined);

      const generate = createBatchConversationGenerator({
        createClient: () => client,
        sleep,
        customId: "community-1",
      });
      const text = await generate("prompt", "api-key");

      expect(create).toHaveBeenCalledTimes(1);
      // ended になるまでポーリングする（in_progress を 1 回挟む）
      expect(retrieve.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(results).toHaveBeenCalledTimes(1);
      expect(text).toBe(expectedText);
    });

    it("create に渡す custom_id・model・prompt が反映される", async () => {
      const { client, create } = buildBatchClient({
        results: [
          {
            custom_id: "c-x",
            result: { type: "succeeded", message: { content: [{ type: "text", text: expectedText }] } },
          },
        ],
      });

      const generate = createBatchConversationGenerator({
        createClient: () => client,
        sleep: () => Promise.resolve(),
        customId: "c-x",
        model: "claude-haiku-4-5",
      });
      await generate("my-prompt", "api-key");

      const arg = create.mock.calls[0][0] as {
        requests: Array<{ custom_id: string; params: { model: string; messages: Array<{ content: string }> } }>;
      };
      expect(arg.requests[0]?.custom_id).toBe("c-x");
      expect(arg.requests[0]?.params.model).toBe("claude-haiku-4-5");
      expect(arg.requests[0]?.params.messages[0]?.content).toBe("my-prompt");
    });

    it("custom_id が一致する succeeded 結果が無いときは空文字を返す", async () => {
      const { client } = buildBatchClient({
        results: [
          {
            custom_id: "other",
            result: { type: "succeeded", message: { content: [{ type: "text", text: expectedText }] } },
          },
        ],
      });

      const generate = createBatchConversationGenerator({
        createClient: () => client,
        sleep: () => Promise.resolve(),
        customId: "community-1",
      });
      const text = await generate("prompt", "api-key");

      expect(text).toBe("");
    });

    it("errored 結果のときは空文字を返す", async () => {
      const { client } = buildBatchClient({
        results: [
          { custom_id: "community-1", result: { type: "errored", error: { type: "invalid_request" } } },
        ],
      });

      const generate = createBatchConversationGenerator({
        createClient: () => client,
        sleep: () => Promise.resolve(),
        customId: "community-1",
      });
      const text = await generate("prompt", "api-key");

      expect(text).toBe("");
    });
  });
});
