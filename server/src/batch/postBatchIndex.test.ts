import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInMemoryBatchRunLogRepository } from "../persistence/batchRunLogRepository.js";
import { createInMemoryCommentRepository } from "../persistence/commentRepository.js";
import {
  createInMemoryCommunityRepository,
  type CommunityRecord,
} from "../persistence/communityRepository.js";
import { createInMemoryPostRepository } from "../persistence/postRepository.js";
import { createInMemorySubscriptionRepository } from "../persistence/subscriptionRepository.js";
import { createInMemoryWorkerCommunityRepository } from "../persistence/workerCommunityRepository.js";
import type { WorkerRecord } from "../persistence/workerRepository.js";
import type { PushNotificationService } from "../services/pushNotificationService.js";

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
  feedUrl: null,
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
    // eslint-disable-next-line max-params
    generate: (prompt: string, apiKey: string) => Promise<{ text: string }>,
  // eslint-disable-next-line max-params
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

  describe("push 通知の community 単位 notifyEnabled 絞り込み（#1088）", () => {
    it("新着投稿があった community の notifyEnabled ユーザーにのみ送る", async () => {
      const generate = vi.fn().mockResolvedValue({ text: validPostOutput });
      const cliDeps = buildCliDeps([community1], generate);

      const subscriptionRepo = createInMemorySubscriptionRepository();
      await subscriptionRepo.add("user-1", "community-1");
      await subscriptionRepo.add("user-2", "community-1");
      await subscriptionRepo.updateNotifyEnabled({
        userId: "user-2",
        communityId: "community-1",
        notifyEnabled: false,
      });

      const sendToUsers = vi.fn().mockResolvedValue(undefined);
      const pushNotificationService: PushNotificationService = { sendToUsers };

      await runPostBatchCli({ ...cliDeps, subscriptionRepo, pushNotificationService });

      expect(sendToUsers).toHaveBeenCalledTimes(1);
      const [, userIds] = sendToUsers.mock.calls[0] as [unknown, string[]];
      expect(userIds).toEqual(["user-1"]);
    });

    it("notify 対象ユーザーがいない場合は sendToUsers を呼ばない", async () => {
      const generate = vi.fn().mockResolvedValue({ text: validPostOutput });
      const cliDeps = buildCliDeps([community1], generate);

      const subscriptionRepo = createInMemorySubscriptionRepository();
      const sendToUsers = vi.fn().mockResolvedValue(undefined);
      const pushNotificationService: PushNotificationService = { sendToUsers };

      await runPostBatchCli({ ...cliDeps, subscriptionRepo, pushNotificationService });

      expect(sendToUsers).not.toHaveBeenCalled();
    });

    it("subscriptionRepo が未設定の場合は push 通知をスキップする", async () => {
      const generate = vi.fn().mockResolvedValue({ text: validPostOutput });
      const cliDeps = buildCliDeps([community1], generate);

      const sendToUsers = vi.fn().mockResolvedValue(undefined);
      const pushNotificationService: PushNotificationService = { sendToUsers };

      await runPostBatchCli({ ...cliDeps, pushNotificationService });

      expect(sendToUsers).not.toHaveBeenCalled();
    });
  });
});
