import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInMemoryBatchRunLogRepository } from "../persistence/batchRunLogRepository.js";
import { createInMemoryCommentRepository } from "../persistence/commentRepository.js";
import {
  createInMemoryCommunityRepository,
  type CommunityRecord,
} from "../persistence/communityRepository.js";
import { createInMemoryPostRepository } from "../persistence/postRepository.js";
import {
  createInMemoryWorkerCommunityRepository,
} from "../persistence/workerCommunityRepository.js";
import type { WorkerRecord } from "../persistence/workerRepository.js";
import { createInMemoryWorldStateRepository } from "../persistence/worldStateRepository.js";

import * as logger from "./logger.js";
import { runPostBatch, POST_COUNT_MIN, POST_COUNT_MAX, DEFAULT_POST_DRIP_WINDOW_MS } from "./runPostBatch.js";

const botWorkers: WorkerRecord[] = [
  {
    id: "haru",
    displayName: "haru",
    role: "ムードメーカー",
    personality: null,
    imageUrl: null,
    deletedAt: null,
  },
  {
    id: "ken",
    displayName: "ken",
    role: "ベテラン",
    personality: null,
    imageUrl: null,
    deletedAt: null,
  },
];

const community1: CommunityRecord = {
  id: "community-1",
  slug: "technology",
  name: "テクノロジー",
  description: "テクノロジーとプログラミングの話題を楽しむコミュニティ。",
  generationInstruction: null,
  feedUrl: null,
  generationPaused: false,
  synopsis: null,
  lastSlotKey: null,
  iconUrl: null,
  coverUrl: null,
  createdAt: new Date("2026-01-01"),
};

const community2: CommunityRecord = {
  id: "community-2",
  slug: "daily",
  name: "日常",
  description: "日常のあれこれを話すコミュニティ。",
  generationInstruction: null,
  feedUrl: null,
  generationPaused: false,
  synopsis: null,
  lastSlotKey: null,
  iconUrl: null,
  coverUrl: null,
  createdAt: new Date("2026-01-02"),
};

/** コメントなしの生成出力 */
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
    {
      id: "p2",
      author: "ken",
      title: "TypeScript 最新事情",
      text: "TypeScript は本当に使いやすくなりました。",
      comments: [],
    },
  ],
});

describe("runPostBatch (#672)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("anthropicApiKey が未設定のとき generate を呼ばずスキップする", async () => {
    const generate = vi.fn();
    const result = await runPostBatch({
      communityRepo: createInMemoryCommunityRepository([community1]),
      postRepo: createInMemoryPostRepository(),
      workerCommunityRepo: createInMemoryWorkerCommunityRepository({ workers: [], links: [] }),
      botWorkerProvider: () => Promise.resolve(botWorkers),
      generate,
    });
    expect(generate).not.toHaveBeenCalled();
    expect(result.posts).toEqual([]);
  });

  it("コミュニティ 0 件のとき generate を呼ばず正常終了する", async () => {
    const generate = vi.fn();
    const result = await runPostBatch({
      communityRepo: createInMemoryCommunityRepository([]),
      postRepo: createInMemoryPostRepository(),
      workerCommunityRepo: createInMemoryWorkerCommunityRepository({ workers: [], links: [] }),
      botWorkerProvider: () => Promise.resolve(botWorkers),
      generate,
      anthropicApiKey: "test-key",
    });
    expect(generate).not.toHaveBeenCalled();
    expect(result.posts).toEqual([]);
  });

  it("全コミュニティに対して generate が 1 回ずつ呼ばれる（#671 方式踏襲）", async () => {
    const generate = vi.fn().mockResolvedValue({ text: validPostOutput });
    await runPostBatch({
      communityRepo: createInMemoryCommunityRepository([community1, community2]),
      postRepo: createInMemoryPostRepository(),
      workerCommunityRepo: createInMemoryWorkerCommunityRepository({ workers: [], links: [] }),
      botWorkerProvider: () => Promise.resolve(botWorkers),
      generate,
      anthropicApiKey: "test-key",
      rng: () => 0,
    });
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("post の createdAt が drip 窓（now 〜 now + dripWindowMs）内に収まる", async () => {
    const now = new Date("2026-01-01T09:00:00Z");
    const dripWindowMs = DEFAULT_POST_DRIP_WINDOW_MS;
    const rng = () => 0.5;

    const generate = vi.fn().mockResolvedValue({ text: validPostOutput });
    const postRepo = createInMemoryPostRepository();

    await runPostBatch({
      communityRepo: createInMemoryCommunityRepository([community1]),
      postRepo,
      workerCommunityRepo: createInMemoryWorkerCommunityRepository({ workers: [], links: [] }),
      botWorkerProvider: () => Promise.resolve(botWorkers),
      generate,
      anthropicApiKey: "test-key",
      rng,
      now,
      dripWindowMs,
    });

    const posts = await postRepo.listByCommunity("community-1");
    expect(posts.length).toBeGreaterThan(0);
    for (const post of posts) {
      expect(post.createdAt.getTime()).toBeGreaterThanOrEqual(now.getTime());
      expect(post.createdAt.getTime()).toBeLessThan(now.getTime() + dripWindowMs);
    }
  });

  it("コメントリポジトリに何も書き込まれない（post-only バッチ）", async () => {
    const generate = vi.fn().mockResolvedValue({ text: validPostOutput });
    const commentRepo = createInMemoryCommentRepository();
    const createManySpy = vi.spyOn(commentRepo, "createMany");

    await runPostBatch({
      communityRepo: createInMemoryCommunityRepository([community1]),
      postRepo: createInMemoryPostRepository(),
      commentRepo,
      workerCommunityRepo: createInMemoryWorkerCommunityRepository({ workers: [], links: [] }),
      botWorkerProvider: () => Promise.resolve(botWorkers),
      generate,
      anthropicApiKey: "test-key",
      rng: () => 0,
    });

    expect(createManySpy).not.toHaveBeenCalled();
  });

  it("1 コミュニティが失敗しても他のコミュニティの処理が継続される", async () => {
    const generate = vi
      .fn()
      .mockRejectedValueOnce(new Error("API エラー"))
      .mockResolvedValueOnce({ text: validPostOutput });

    const postRepo = createInMemoryPostRepository();
    const result = await runPostBatch({
      communityRepo: createInMemoryCommunityRepository([community1, community2]),
      postRepo,
      workerCommunityRepo: createInMemoryWorkerCommunityRepository({ workers: [], links: [] }),
      botWorkerProvider: () => Promise.resolve(botWorkers),
      generate,
      anthropicApiKey: "test-key",
      rng: () => 0,
    });

    expect(generate).toHaveBeenCalledTimes(2);
    // 1 件は失敗、もう 1 件は成功 → posts > 0
    expect(result.posts.length).toBeGreaterThan(0);
  });

  it("成功コミュニティに BatchRunLog(success) が、失敗コミュニティに BatchRunLog(failure) が記録される", async () => {
    const generate = vi
      .fn()
      .mockRejectedValueOnce(new Error("失敗"))
      .mockResolvedValueOnce({ text: validPostOutput });

    const batchRunLogRepo = createInMemoryBatchRunLogRepository();
    const createSpy = vi.spyOn(batchRunLogRepo, "create");

    await runPostBatch({
      communityRepo: createInMemoryCommunityRepository([community1, community2]),
      postRepo: createInMemoryPostRepository(),
      workerCommunityRepo: createInMemoryWorkerCommunityRepository({ workers: [], links: [] }),
      botWorkerProvider: () => Promise.resolve(botWorkers),
      batchRunLogRepository: batchRunLogRepo,
      generate,
      anthropicApiKey: "test-key",
      rng: () => 0,
    });

    const calls = createSpy.mock.calls.map((args) => args[0].status);
    expect(calls).toContain("success");
    expect(calls).toContain("failure");
  });

  it("WorldState の lastAppearedSlotKey が登場ワーカーの id で更新される", async () => {
    const generate = vi.fn().mockResolvedValue({ text: validPostOutput });
    const worldStateRepo = createInMemoryWorldStateRepository();

    await runPostBatch({
      communityRepo: createInMemoryCommunityRepository([community1]),
      postRepo: createInMemoryPostRepository(),
      workerCommunityRepo: createInMemoryWorkerCommunityRepository({ workers: [], links: [] }),
      botWorkerProvider: () => Promise.resolve(botWorkers),
      worldStateRepository: worldStateRepo,
      generate,
      anthropicApiKey: "test-key",
      rng: () => 0,
      slotKey: "2026-01-01T09:00",
    });

    const worldState = await worldStateRepo.get();
    expect(worldState).not.toBeNull();
    // haru と ken が登場したため、どちらかの lastAppearedSlotKey が更新される
    const haruState = worldState?.workerStates["haru"];
    const kenState = worldState?.workerStates["ken"];
    const updatedCount = [haruState, kenState].filter(
      (s) => s?.lastAppearedSlotKey === "2026-01-01T09:00",
    ).length;
    expect(updatedCount).toBeGreaterThan(0);
  });

  describe("直近投稿とのテキスト類似度検知（#1115）", () => {
    it("生成された post 本文が直近 post 本文とほぼ同一のとき post_batch.duplicate_text_detected をログ出力する", async () => {
      const now = new Date("2026-06-18T12:00:00Z");
      const generate = vi.fn().mockResolvedValue({ text: validPostOutput });
      const postRepo = createInMemoryPostRepository();
      const logSpy = vi.spyOn(logger, "logBatchInfo");

      // validPostOutput の p1.text と同一の既存 post をあらかじめ永続化しておく
      await postRepo.createMany(community1.id, [
        {
          slotKey: "slot-existing",
          seq: 0,
          author: "haru",
          title: "AIの進歩について",
          text: "最近のAI技術の進歩が目覚ましいですね。",
          createdAt: new Date(now.getTime() - 60 * 60 * 1000),
        },
      ]);

      await runPostBatch({
        communityRepo: createInMemoryCommunityRepository([community1]),
        postRepo,
        workerCommunityRepo: createInMemoryWorkerCommunityRepository({ workers: [], links: [] }),
        botWorkerProvider: () => Promise.resolve(botWorkers),
        generate,
        anthropicApiKey: "test-key",
        rng: () => 0,
        now,
      });

      expect(logSpy).toHaveBeenCalledWith(
        "post_batch.duplicate_text_detected",
        expect.objectContaining({
          communityId: community1.id,
          matchedTitle: "AIの進歩について",
        }),
      );
    });

    it("直近 post と内容が異なる場合は post_batch.duplicate_text_detected をログ出力しない", async () => {
      const now = new Date("2026-06-18T12:00:00Z");
      const generate = vi.fn().mockResolvedValue({ text: validPostOutput });
      const postRepo = createInMemoryPostRepository();
      const logSpy = vi.spyOn(logger, "logBatchInfo");

      await postRepo.createMany(community1.id, [
        {
          slotKey: "slot-existing",
          seq: 0,
          author: "haru",
          title: "まったく無関係の話題",
          text: "今日は近所のカフェでコーヒーを飲みながら本を読んだ。",
          createdAt: new Date(now.getTime() - 60 * 60 * 1000),
        },
      ]);

      await runPostBatch({
        communityRepo: createInMemoryCommunityRepository([community1]),
        postRepo,
        workerCommunityRepo: createInMemoryWorkerCommunityRepository({ workers: [], links: [] }),
        botWorkerProvider: () => Promise.resolve(botWorkers),
        generate,
        anthropicApiKey: "test-key",
        rng: () => 0,
        now,
      });

      expect(logSpy).not.toHaveBeenCalledWith(
        "post_batch.duplicate_text_detected",
        expect.anything(),
      );
    });
  });

  describe("リトライ (#626)", () => {
    it("JSON パース失敗が 1 回でリトライ成功する場合、generate が 2 回呼ばれ post が永続化される", async () => {
      const generate = vi.fn()
        .mockResolvedValueOnce({ text: "INVALID JSON" })
        .mockResolvedValueOnce({ text: validPostOutput });

      const postRepo = createInMemoryPostRepository();
      const result = await runPostBatch({
        communityRepo: createInMemoryCommunityRepository([community1]),
        postRepo,
        workerCommunityRepo: createInMemoryWorkerCommunityRepository({ workers: [], links: [] }),
        botWorkerProvider: () => Promise.resolve(botWorkers),
        generate,
        anthropicApiKey: "test-key",
        rng: () => 0,
      });

      expect(generate).toHaveBeenCalledTimes(2);
      expect(result.posts.length).toBeGreaterThan(0);
    });

    it("リトライ上限到達（3回連続失敗）で BatchRunLog(failure) が記録され post は保存されない", async () => {
      const generate = vi.fn().mockResolvedValue({ text: "INVALID JSON" });
      const batchRunLogRepo = createInMemoryBatchRunLogRepository();
      const createSpy = vi.spyOn(batchRunLogRepo, "create");

      const result = await runPostBatch({
        communityRepo: createInMemoryCommunityRepository([community1]),
        postRepo: createInMemoryPostRepository(),
        workerCommunityRepo: createInMemoryWorkerCommunityRepository({ workers: [], links: [] }),
        botWorkerProvider: () => Promise.resolve(botWorkers),
        batchRunLogRepository: batchRunLogRepo,
        generate,
        anthropicApiKey: "test-key",
        rng: () => 0,
      });

      expect(generate).toHaveBeenCalledTimes(3);
      expect(result.posts).toHaveLength(0);
      expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ status: "failure" }));
    });

    it("author 検証失敗が 1 回でリトライ成功する", async () => {
      const badAuthorOutput = JSON.stringify({
        topic: "test",
        posts: [{ id: "p1", author: "unknown-xyz", title: "タイトル", text: "本文", comments: [] }],
      });
      const generate = vi.fn()
        .mockResolvedValueOnce({ text: badAuthorOutput })
        .mockResolvedValueOnce({ text: validPostOutput });

      const result = await runPostBatch({
        communityRepo: createInMemoryCommunityRepository([community1]),
        postRepo: createInMemoryPostRepository(),
        workerCommunityRepo: createInMemoryWorkerCommunityRepository({ workers: [], links: [] }),
        botWorkerProvider: () => Promise.resolve(botWorkers),
        generate,
        anthropicApiKey: "test-key",
        rng: () => 0,
      });

      expect(generate).toHaveBeenCalledTimes(2);
      expect(result.posts.length).toBeGreaterThan(0);
    });
  });

  it("POST_COUNT_MIN / POST_COUNT_MAX の定数が 1 / 1 である（コミュニティごとに 1 件固定）", () => {
    expect(POST_COUNT_MIN).toBe(1);
    expect(POST_COUNT_MAX).toBe(1);
  });

  it("DEFAULT_POST_DRIP_WINDOW_MS は 24h（86400000ms）である", () => {
    expect(DEFAULT_POST_DRIP_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("generationPaused=true のコミュニティは post 生成から除外される（#1011）", async () => {
    const pausedCommunity: CommunityRecord = {
      id: "paused-community",
      slug: "paused",
      name: "停止中コミュニティ",
      description: "生成が停止されているコミュニティ",
      generationInstruction: null,
      feedUrl: null,
      synopsis: null,
      lastSlotKey: null,
      iconUrl: null,
      coverUrl: null,
      createdAt: new Date("2026-01-01"),
      generationPaused: true,
    };
    const activeCommunity: CommunityRecord = {
      ...community2,
      generationPaused: false,
    };
    const generate = vi.fn().mockResolvedValue({ text: validPostOutput });
    const postRepo = createInMemoryPostRepository();

    await runPostBatch({
      communityRepo: createInMemoryCommunityRepository([pausedCommunity, activeCommunity]),
      postRepo,
      workerCommunityRepo: createInMemoryWorkerCommunityRepository({ workers: [], links: [] }),
      botWorkerProvider: () => Promise.resolve(botWorkers),
      generate,
      anthropicApiKey: "test-key",
      rng: () => 0,
    });

    // 稼働中のコミュニティには post が作られる
    const activePosts = await postRepo.listByCommunity(activeCommunity.id);
    expect(activePosts.length).toBeGreaterThan(0);
    // paused コミュニティには post が作られない
    const pausedPosts = await postRepo.listByCommunity(pausedCommunity.id);
    expect(pausedPosts).toHaveLength(0);
    // generate は稼働中の 1 件のみに対して呼ばれる
    expect(generate).toHaveBeenCalledTimes(1);
  });
});

describe("外部フィード（feedUrl）の post バッチへの注入（#1104 / ADR-0035）", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("(a) feedUrl 未設定のコミュニティでは fetchFeed を呼ばない", async () => {
    const generate = vi.fn().mockResolvedValue({ text: validPostOutput });
    const fetchFeed = vi.fn().mockResolvedValue([]);

    await runPostBatch({
      communityRepo: createInMemoryCommunityRepository([community1]),
      postRepo: createInMemoryPostRepository(),
      workerCommunityRepo: createInMemoryWorkerCommunityRepository({ workers: [], links: [] }),
      botWorkerProvider: () => Promise.resolve(botWorkers),
      generate,
      fetchFeed,
      anthropicApiKey: "test-key",
      rng: () => 0,
    });

    expect(fetchFeed).not.toHaveBeenCalled();
  });

  it("(b) feedUrl 設定時に fetchFeed を呼び、取得記事がプロンプトに注入される", async () => {
    const communityWithFeed: CommunityRecord = {
      ...community1,
      feedUrl: "https://zenn.dev/feed",
    };
    const generate = vi.fn().mockResolvedValue({ text: validPostOutput });
    const fetchFeed = vi.fn().mockResolvedValue([
      { title: "TypeScript 5.0 の新機能", url: "https://zenn.dev/a", summary: "概要", author: "yamada" },
    ]);

    await runPostBatch({
      communityRepo: createInMemoryCommunityRepository([communityWithFeed]),
      postRepo: createInMemoryPostRepository(),
      workerCommunityRepo: createInMemoryWorkerCommunityRepository({ workers: [], links: [] }),
      botWorkerProvider: () => Promise.resolve(botWorkers),
      generate,
      fetchFeed,
      anthropicApiKey: "test-key",
      rng: () => 0,
    });

    expect(fetchFeed).toHaveBeenCalledWith({ feedUrl: "https://zenn.dev/feed" });
    const promptArg = generate.mock.calls[0]?.[0] as string;
    expect(promptArg).toContain("TypeScript 5.0 の新機能");
  });

  it("(c) フィード取得失敗（空配列）時は通常生成にフォールバックしバッチが中断しない", async () => {
    const communityWithFeed: CommunityRecord = {
      ...community1,
      feedUrl: "https://zenn.dev/feed",
    };
    const generate = vi.fn().mockResolvedValue({ text: validPostOutput });
    const fetchFeed = vi.fn().mockResolvedValue([]);
    const postRepo = createInMemoryPostRepository();

    const result = await runPostBatch({
      communityRepo: createInMemoryCommunityRepository([communityWithFeed]),
      postRepo,
      workerCommunityRepo: createInMemoryWorkerCommunityRepository({ workers: [], links: [] }),
      botWorkerProvider: () => Promise.resolve(botWorkers),
      generate,
      fetchFeed,
      anthropicApiKey: "test-key",
      rng: () => 0,
    });

    expect(fetchFeed).toHaveBeenCalledWith({ feedUrl: "https://zenn.dev/feed" });
    expect(result.posts.length).toBeGreaterThan(0);
    const promptArg = generate.mock.calls[0]?.[0] as string;
    expect(promptArg).not.toContain("最新フィード記事");
  });
});
