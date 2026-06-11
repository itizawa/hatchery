import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@anthropic-ai/sdk");

import Anthropic from "@anthropic-ai/sdk";
import { generateConversationWithClaude, generateSummaryWithClaude } from "./aiMessageGenerator.js";

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
    vi.spyOn(console, "warn").mockImplementation(() => {});
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

    it("stop_reason が 'max_tokens' のとき console.warn を呼ぶ", async () => {
      mockCreate.mockResolvedValue(makeMessage("max_tokens", '{"topic":"test","po'));

      await generateConversationWithClaude("community: テクノロジー テストプロンプト", "api-key");

      expect(console.warn).toHaveBeenCalledOnce();
      const warnArg = (console.warn as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(warnArg).toContain("max_tokens");
    });

    it("stop_reason が 'end_turn' のとき console.warn を呼ばない", async () => {
      mockCreate.mockResolvedValue(makeMessage("end_turn", '{"topic":"test","posts":[]}'));

      await generateConversationWithClaude("test prompt", "api-key");

      expect(console.warn).not.toHaveBeenCalled();
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
});
