import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Channel } from "@hatchery/common";

import type { AppSettingRepository } from "../persistence/appSettingRepository.js";
import { InMemoryChannelRepository } from "../persistence/channelRepository.js";
import { InMemoryMessageRepository } from "../persistence/messageRepository.js";

import { runResearcherBatch, type CreateIssueResult, type RunQueryFn } from "./researcherBatch.js";

const issueChannel: Channel = {
  id: "researcher-ch",
  label: "リサーチャー",
  type: "planning",
  goal: { type: "issue", instructions: "競合調査をして改善点を Issue 化して" },
};

/**
 * query() のスタブ。与えた「起票提案」を createIssue 経由で順に起票し、
 * 最後に success の result メッセージを返す AsyncGenerator を生成する。
 */
function makeQueryStub(
  proposals: { title: string; reason: string }[],
  resultSubtype: "success" | "error_max_turns" | "error_max_budget_usd" = "success",
): RunQueryFn {
  return vi.fn(({ createIssue }) => {
    async function* gen() {
      for (const p of proposals) {
        await createIssue({ title: p.title, body: p.reason, reason: p.reason });
      }
      yield {
        type: "result",
        subtype: resultSubtype,
        is_error: resultSubtype !== "success",
        num_turns: 3,
        total_cost_usd: 0.01,
      } as never;
    }
    return gen();
  });
}

describe("runResearcherBatch: Agent SDK リサーチャー自律起票（#285）", () => {
  let messageRepo: InMemoryMessageRepository;
  let appSettingRepo: AppSettingRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    messageRepo = new InMemoryMessageRepository();
    appSettingRepo = {
      findAll: vi.fn().mockResolvedValue([]),
      findByKey: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
    };
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.GITHUB_TOKEN = "ghtoken";
    process.env.GITHUB_OWNER = "itizawa";
    process.env.GITHUB_REPO = "hatchery";
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_OWNER;
    delete process.env.GITHUB_REPO;
    vi.restoreAllMocks();
  });

  it("(a) 提案を起票すると createPlanningMessage + updateIssueRef が呼ばれ issueNumber/issueUrl が残る", async () => {
    const channelRepo = new InMemoryChannelRepository([issueChannel]);
    let issued = 0;
    const createIssue = vi.fn(
      (input: { title: string; body: string }): Promise<CreateIssueResult> => {
        issued += 1;
        return Promise.resolve({
          status: "created",
          issueNumber: 200 + issued,
          issueUrl: `https://example.test/${input.title}`,
        });
      },
    );

    const records = await runResearcherBatch({
      channelRepo,
      messageRepo,
      appSettingRepo,
      runQuery: makeQueryStub([{ title: "提案A", reason: "理由A" }]),
      createIssueForChannel: () => createIssue,
    });

    expect(createIssue).toHaveBeenCalledTimes(1);
    expect(records).toHaveLength(1);
    expect(records[0].issueNumber).toBe(201);
    expect(records[0].issueUrl).toBe("https://example.test/提案A");
    expect(records[0].channel).toBe("researcher-ch");
  });

  it("goal=chat のみの場合はスキップして空配列・query を呼ばない", async () => {
    const chatChannel: Channel = { id: "chat", label: "雑談", type: "zatsudan", goal: { type: "chat" } };
    const channelRepo = new InMemoryChannelRepository([chatChannel]);
    const runQuery = makeQueryStub([{ title: "提案A", reason: "理由A" }]);

    const records = await runResearcherBatch({
      channelRepo,
      messageRepo,
      appSettingRepo,
      runQuery,
      createIssueForChannel: () => vi.fn(),
    });

    expect(records).toHaveLength(0);
    expect(runQuery).not.toHaveBeenCalled();
  });

  it("(b) maxTurns/予算超過の result が返ったらそのチャンネルを打ち切りログを残す", async () => {
    const channelRepo = new InMemoryChannelRepository([issueChannel]);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const createIssue = vi.fn(
      (): Promise<CreateIssueResult> =>
        Promise.resolve({ status: "created", issueNumber: 1, issueUrl: "u" }),
    );

    const records = await runResearcherBatch({
      channelRepo,
      messageRepo,
      appSettingRepo,
      runQuery: makeQueryStub([{ title: "提案A", reason: "理由A" }], "error_max_budget_usd"),
      createIssueForChannel: () => createIssue,
    });

    // 起票自体は行われるが、打ち切りが警告ログに残る
    expect(records).toHaveLength(1);
    expect(warnSpy.mock.calls.some((c) => String(c[0]).includes("error_max_budget_usd"))).toBe(true);
  });

  it("(c) ANTHROPIC_API_KEY 未設定でスキップ（query を呼ばない・空）", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const channelRepo = new InMemoryChannelRepository([issueChannel]);
    const runQuery = makeQueryStub([{ title: "提案A", reason: "理由A" }]);

    const records = await runResearcherBatch({
      channelRepo,
      messageRepo,
      appSettingRepo,
      runQuery,
      createIssueForChannel: () => vi.fn(),
    });

    expect(records).toHaveLength(0);
    expect(runQuery).not.toHaveBeenCalled();
  });

  it("(c) GITHUB_TOKEN 未設定でスキップ（query を呼ばない・空）", async () => {
    delete process.env.GITHUB_TOKEN;
    const channelRepo = new InMemoryChannelRepository([issueChannel]);
    const runQuery = makeQueryStub([{ title: "提案A", reason: "理由A" }]);

    const records = await runResearcherBatch({
      channelRepo,
      messageRepo,
      appSettingRepo,
      runQuery,
      createIssueForChannel: () => vi.fn(),
    });

    expect(records).toHaveLength(0);
    expect(runQuery).not.toHaveBeenCalled();
  });

  it("(d) 起票ツールが duplicate を返した提案はメッセージを残さない（重複起票しない）", async () => {
    const channelRepo = new InMemoryChannelRepository([issueChannel]);
    // 起票ツールの dedup を模した stub: 同一タイトルの 2 回目は duplicate を返す。
    const seen = new Set<string>();
    const createIssue = vi.fn((input: { title: string }): Promise<CreateIssueResult> => {
      if (seen.has(input.title)) {
        return Promise.resolve({ status: "duplicate" });
      }
      seen.add(input.title);
      return Promise.resolve({ status: "created", issueNumber: 1, issueUrl: "u1" });
    });

    const records = await runResearcherBatch({
      channelRepo,
      messageRepo,
      appSettingRepo,
      runQuery: makeQueryStub([
        { title: "提案A", reason: "理由A" },
        { title: "提案A", reason: "理由A再" },
      ]),
      createIssueForChannel: () => createIssue,
    });

    expect(createIssue).toHaveBeenCalledTimes(2);
    expect(records).toHaveLength(1);
    expect(records[0].issueNumber).toBe(1);
  });
});
