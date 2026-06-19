import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInMemoryBatchRunLogRepository } from "../persistence/batchRunLogRepository.js";
import { createInMemoryCommentRepository } from "../persistence/commentRepository.js";
import {
  createInMemoryCommunityRepository,
  type CommunityRecord,
} from "../persistence/communityRepository.js";
import { createInMemoryPostRepository } from "../persistence/postRepository.js";
import { createInMemoryWorkerCommunityRepository } from "../persistence/workerCommunityRepository.js";
import type { WorkerRecord } from "../persistence/workerRepository.js";

import { runPostBatchCli, type PostBatchCliDeps } from "./postBatchIndex.js";

const botWorkers: WorkerRecord[] = [
  { id: "haru", displayName: "haru", role: "ムードメーカー", personality: null, imageUrl: null, deletedAt: null },
  { id: "ken", displayName: "ken", role: "ベテラン", personality: null, imageUrl: null, deletedAt: null },
];

const community1: CommunityRecord = {
  id: "community-1",
  slug: "technology",
  name: "テクノロジー",
  description: "テクノロジーとプログラミングの話題を楽しむコミュニティ。",
  synopsis: null,
  lastSlotKey: null,
  iconUrl: null,
  coverUrl: null,
  generationInstruction: null,
  createdAt: new Date("2026-01-01"),
};

const validPostOutput = JSON.stringify({
  topic: "今日のテクノロジーニュース",
  posts: [
    {
      id: "p1",
      author: "haru",
      title: "最新のAI動向について",
      text: "最近のAI技術の進歩が目覚ましいですね。",
      comments: [],
    },
  ],
});

describe("postBatchIndex (#672)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const buildCliDeps = (
    communities: CommunityRecord[],
    generate: (prompt: string, apiKey: string) => Promise<{ text: string }>,
  ): PostBatchCliDeps & { disconnect: ReturnType<typeof vi.fn> } => {
    const disconnect = vi.fn().mockResolvedValue(undefined);
    return {
      batchDeps: {
        communityRepo: createInMemoryCommunityRepository(communities),
        postRepo: createInMemoryPostRepository(),
        commentRepo: createInMemoryCommentRepository(),
        batchRunLogRepository: createInMemoryBatchRunLogRepository(),
        workerCommunityRepo: createInMemoryWorkerCommunityRepository({ workers: [], links: [] }),
        botWorkerProvider: () => Promise.resolve(botWorkers),
        generate,
        anthropicApiKey: "test-key",
        rng: () => 0,
      },
      disconnect,
    };
  };

  it("全コミュニティに対して generate が呼ばれる", async () => {
    const generate = vi.fn().mockResolvedValue({ text: validPostOutput });
    const cliDeps = buildCliDeps([community1], generate);

    const result = await runPostBatchCli(cliDeps);

    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.posts.some((p) => p.communityId === "community-1")).toBe(true);
  });

  it("正常終了時に disconnect が 1 回呼ばれる", async () => {
    const generate = vi.fn().mockResolvedValue({ text: validPostOutput });
    const cliDeps = buildCliDeps([community1], generate);

    await runPostBatchCli(cliDeps);

    expect(cliDeps.disconnect).toHaveBeenCalledTimes(1);
  });

  it("バッチ本体が throw した場合も disconnect が呼ばれ reject する", async () => {
    const generate = vi.fn();
    const cliDeps = buildCliDeps([], generate);
    cliDeps.batchDeps.communityRepo = {
      ...cliDeps.batchDeps.communityRepo,
      list: vi.fn().mockRejectedValue(new Error("DB ダウン")),
    };

    await expect(runPostBatchCli(cliDeps)).rejects.toThrow("DB ダウン");
    expect(cliDeps.disconnect).toHaveBeenCalledTimes(1);
  });

  it("モジュールを import しただけではバッチが実行されない（直接実行ガード）", () => {
    const generate = vi.fn();
    const cliDeps = buildCliDeps([community1], generate);
    expect(generate).not.toHaveBeenCalled();
    expect(cliDeps.disconnect).not.toHaveBeenCalled();
  });
});
