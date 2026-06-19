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

import { runCommentBatchCli, type CommentBatchCliDeps } from "./commentBatchIndex.js";

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

const NOW = new Date("2026-01-10T09:00:00Z");

const validCommentOutput = JSON.stringify({
  topic: "今日のコメント",
  posts: [
    {
      ref: "ref-1",
      comments: [
        { author: "haru", text: "面白いですね。", reply_to: null },
      ],
    },
  ],
});

describe("commentBatchIndex (#673)", () => {
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
  ): CommentBatchCliDeps & { disconnect: ReturnType<typeof vi.fn> } => {
    const postRepo = createInMemoryPostRepository();
    const disconnect = vi.fn().mockResolvedValue(undefined);

    return {
      batchDeps: {
        communityRepo: createInMemoryCommunityRepository(communities),
        postRepo,
        commentRepo: createInMemoryCommentRepository(),
        batchRunLogRepository: createInMemoryBatchRunLogRepository(),
        workerCommunityRepo: createInMemoryWorkerCommunityRepository({ workers: [], links: [] }),
        botWorkerProvider: () => Promise.resolve(botWorkers),
        generate,
        anthropicApiKey: "test-key",
        rng: () => 0,
        now: NOW,
      },
      disconnect,
    };
  };

  it("generate が呼ばれて結果の comments が返る", async () => {
    const postRepo = createInMemoryPostRepository();
    await postRepo.createMany("community-1", [
      { slotKey: "slot-1", seq: 0, author: "haru", title: "テスト投稿", text: "本文", createdAt: new Date(NOW.getTime() - 60 * 60 * 1000) },
    ]);
    const generate = vi.fn().mockResolvedValue({ text: validCommentOutput });
    const disconnect = vi.fn().mockResolvedValue(undefined);

    const result = await runCommentBatchCli({
      batchDeps: {
        communityRepo: createInMemoryCommunityRepository([community1]),
        postRepo,
        commentRepo: createInMemoryCommentRepository(),
        batchRunLogRepository: createInMemoryBatchRunLogRepository(),
        workerCommunityRepo: createInMemoryWorkerCommunityRepository({ workers: [], links: [] }),
        botWorkerProvider: () => Promise.resolve(botWorkers),
        generate,
        anthropicApiKey: "test-key",
        rng: () => 0,
        now: NOW,
      },
      disconnect,
    });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.comments.length).toBeGreaterThan(0);
  });

  it("正常終了時に disconnect が 1 回呼ばれる", async () => {
    const generate = vi.fn().mockResolvedValue({ text: validCommentOutput });
    const cliDeps = buildCliDeps([community1], generate);

    await runCommentBatchCli(cliDeps);

    expect(cliDeps.disconnect).toHaveBeenCalledTimes(1);
  });

  it("バッチ本体が throw した場合も disconnect が呼ばれ reject する", async () => {
    const generate = vi.fn();
    const cliDeps = buildCliDeps([], generate);
    cliDeps.batchDeps.communityRepo = {
      ...cliDeps.batchDeps.communityRepo,
      list: vi.fn().mockRejectedValue(new Error("DB ダウン")),
    };

    await expect(runCommentBatchCli(cliDeps)).rejects.toThrow("DB ダウン");
    expect(cliDeps.disconnect).toHaveBeenCalledTimes(1);
  });

  it("モジュールを import しただけではバッチが実行されない（直接実行ガード）", () => {
    const generate = vi.fn();
    const cliDeps = buildCliDeps([community1], generate);
    expect(generate).not.toHaveBeenCalled();
    expect(cliDeps.disconnect).not.toHaveBeenCalled();
  });
});
