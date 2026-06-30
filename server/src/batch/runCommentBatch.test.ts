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

import {
  runCommentBatch,
  COMMENT_TARGET_WINDOW_DAYS,
  DEFAULT_COMMENT_DRIP_WINDOW_MS,
} from "./runCommentBatch.js";

const botWorker: WorkerRecord = {
  id: "worker-bot-1",
  displayName: "ボットワーカー",
  role: null,
  personality: null,
  imageUrl: null,
  deletedAt: null,
};

const community1: CommunityRecord = {
  id: "community-1",
  slug: "technology",
  name: "テクノロジー",
  description: "テクノロジーの話題を楽しむコミュニティ。",
  generationInstruction: null,
  feedUrl: null,
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
  synopsis: null,
  lastSlotKey: null,
  iconUrl: null,
  coverUrl: null,
  createdAt: new Date("2026-01-02"),
};

const NOW = new Date("2026-01-10T09:00:00Z");

/** 直近3日以内の createdAt を生成 */
function recentDate(hoursAgo = 24): Date {
  return new Date(NOW.getTime() - hoursAgo * 60 * 60 * 1000);
}

/** 3日超前の createdAt を生成 */
function oldDate(daysAgo = 5): Date {
  return new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000);
}

/** comment バッチ用の有効な生成出力 */
// eslint-disable-next-line max-params
function makeCommentOutput(ref = "ref-1", authorId = "worker-bot-1") {
  return JSON.stringify({
    topic: "テストトピック",
    posts: [
      {
        ref,
        comments: [{ author: authorId, text: "テストコメント", reply_to: null }],
      },
    ],
  });
}

describe("runCommentBatch (#673)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("早期 return ケース", () => {
    it("anthropicApiKey が未設定のとき generate を呼ばずスキップする", async () => {
      const generate = vi.fn();
      const result = await runCommentBatch({
        communityRepo: createInMemoryCommunityRepository([community1]),
        postRepo: createInMemoryPostRepository(),
        commentRepo: createInMemoryCommentRepository(),
        workerCommunityRepo: createInMemoryWorkerCommunityRepository({
          workers: [botWorker],
          links: [{ workerId: botWorker.id, communityId: community1.id }],
        }),
        generate,
        now: NOW,
      });
      expect(generate).not.toHaveBeenCalled();
      expect(result.comments).toEqual([]);
    });

    it("コミュニティ 0 件のとき generate を呼ばず正常終了する", async () => {
      const generate = vi.fn();
      const result = await runCommentBatch({
        communityRepo: createInMemoryCommunityRepository([]),
        postRepo: createInMemoryPostRepository(),
        commentRepo: createInMemoryCommentRepository(),
        workerCommunityRepo: createInMemoryWorkerCommunityRepository({ workers: [], links: [] }),
        generate,
        anthropicApiKey: "test-key",
        now: NOW,
      });
      expect(generate).not.toHaveBeenCalled();
      expect(result.comments).toEqual([]);
    });

    it("コミュニティに直近3日以内の post がない場合はそのコミュニティをスキップする", async () => {
      const postRepo = createInMemoryPostRepository();
      // 7日前の古い post のみ
      await postRepo.createMany(community1.id, [
        {
          slotKey: "old-slot",
          seq: 0,
          author: botWorker.id,
          title: "古い投稿",
          text: "3日超前の投稿",
          createdAt: oldDate(7),
        },
      ]);

      const generate = vi.fn();
      const result = await runCommentBatch({
        communityRepo: createInMemoryCommunityRepository([community1]),
        postRepo,
        commentRepo: createInMemoryCommentRepository(),
        workerCommunityRepo: createInMemoryWorkerCommunityRepository({
          workers: [botWorker],
          links: [{ workerId: botWorker.id, communityId: community1.id }],
        }),
        generate,
        anthropicApiKey: "test-key",
        now: NOW,
        revivalProbability: 0, // 古い post 活性化なし
      });
      expect(generate).not.toHaveBeenCalled();
      expect(result.comments).toEqual([]);
    });
  });

  describe("正常系", () => {
    it("直近3日以内の post に対してコメントを生成・保存する", async () => {
      const postRepo = createInMemoryPostRepository();
      const commentRepo = createInMemoryCommentRepository();
      const [recentPost] = await postRepo.createMany(community1.id, [
        {
          slotKey: "recent-slot",
          seq: 0,
          author: botWorker.id,
          title: "直近の投稿",
          text: "3日以内の投稿本文",
          createdAt: recentDate(24),
        },
      ]);

      const generate = vi.fn().mockResolvedValue({ text: makeCommentOutput("ref-1") });

      const result = await runCommentBatch({
        communityRepo: createInMemoryCommunityRepository([community1]),
        postRepo,
        commentRepo,
        workerCommunityRepo: createInMemoryWorkerCommunityRepository({
          workers: [botWorker],
          links: [{ workerId: botWorker.id, communityId: community1.id }],
        }),
        generate,
        anthropicApiKey: "test-key",
        slotKey: "2026-01-10T09:00",
        rng: () => 0.5,
        now: NOW,
        revivalProbability: 0,
      });

      expect(generate).toHaveBeenCalledTimes(1);
      expect(result.comments).toHaveLength(1);
      expect(result.comments[0]?.postId).toBe(recentPost!.id);
      expect(result.comments[0]?.text).toBe("テストコメント");
    });

    it("全コミュニティに対して generate が 1 回ずつ呼ばれる（ADR-0033 方式踏襲）", async () => {
      const postRepo = createInMemoryPostRepository();
      await postRepo.createMany(community1.id, [
        {
          slotKey: "slot-c1",
          seq: 0,
          author: botWorker.id,
          title: "C1投稿",
          text: "本文",
          createdAt: recentDate(),
        },
      ]);
      await postRepo.createMany(community2.id, [
        {
          slotKey: "slot-c2",
          seq: 0,
          author: botWorker.id,
          title: "C2投稿",
          text: "本文",
          createdAt: recentDate(),
        },
      ]);

      const generate = vi.fn().mockResolvedValue({ text: makeCommentOutput("ref-1") });

      await runCommentBatch({
        communityRepo: createInMemoryCommunityRepository([community1, community2]),
        postRepo,
        commentRepo: createInMemoryCommentRepository(),
        workerCommunityRepo: createInMemoryWorkerCommunityRepository({
          workers: [botWorker],
          links: [
            { workerId: botWorker.id, communityId: community1.id },
            { workerId: botWorker.id, communityId: community2.id },
          ],
        }),
        generate,
        anthropicApiKey: "test-key",
        now: NOW,
        revivalProbability: 0,
      });

      expect(generate).toHaveBeenCalledTimes(2);
    });

    it("スコアが高い post はより多いコメント数ヒントがプロンプトに含まれる", async () => {
      const postRepo = createInMemoryPostRepository();
      // score=8 の post（commentCount=5）
      const [highPost] = await postRepo.createMany(community1.id, [
        {
          slotKey: "slot-high",
          seq: 0,
          author: botWorker.id,
          title: "高スコア投稿",
          text: "本文",
          createdAt: recentDate(),
        },
      ]);
      await postRepo.addScore(highPost!.id, 8);
      // score=0 の post（commentCount=1）
      await postRepo.createMany(community1.id, [
        {
          slotKey: "slot-low",
          seq: 1,
          author: botWorker.id,
          title: "低スコア投稿",
          text: "本文",
          createdAt: recentDate(48),
        },
      ]);

      let capturedPrompt = "";
      const generate = vi.fn().mockImplementation(async (prompt: string) => {
        capturedPrompt = prompt;
        return { text: makeCommentOutput("ref-1") };
      });

      await runCommentBatch({
        communityRepo: createInMemoryCommunityRepository([community1]),
        postRepo,
        commentRepo: createInMemoryCommentRepository(),
        workerCommunityRepo: createInMemoryWorkerCommunityRepository({
          workers: [botWorker],
          links: [{ workerId: botWorker.id, communityId: community1.id }],
        }),
        generate,
        anthropicApiKey: "test-key",
        now: NOW,
        revivalProbability: 0,
      });

      // score=8 → commentCount=5、score=0 → commentCount=1 がプロンプトに含まれる
      expect(capturedPrompt).toContain("5");
    });

    it("コメントの createdAt が drip 窓内に収まる", async () => {
      const postRepo = createInMemoryPostRepository();
      await postRepo.createMany(community1.id, [
        {
          slotKey: "slot-drip",
          seq: 0,
          author: botWorker.id,
          title: "投稿",
          text: "本文",
          createdAt: recentDate(),
        },
      ]);

      const dripWindowMs = DEFAULT_COMMENT_DRIP_WINDOW_MS;
      const generate = vi.fn().mockResolvedValue({ text: makeCommentOutput("ref-1") });
      const commentRepo = createInMemoryCommentRepository();

      await runCommentBatch({
        communityRepo: createInMemoryCommunityRepository([community1]),
        postRepo,
        commentRepo,
        workerCommunityRepo: createInMemoryWorkerCommunityRepository({
          workers: [botWorker],
          links: [{ workerId: botWorker.id, communityId: community1.id }],
        }),
        generate,
        anthropicApiKey: "test-key",
        slotKey: "2026-01-10T09:00",
        rng: () => 0.5,
        now: NOW,
        dripWindowMs,
        revivalProbability: 0,
      });

      const comments = await commentRepo.listByCommunity(community1.id);
      expect(comments.length).toBeGreaterThan(0);
      for (const c of comments) {
        expect(c.createdAt.getTime()).toBeGreaterThanOrEqual(NOW.getTime());
        expect(c.createdAt.getTime()).toBeLessThan(NOW.getTime() + dripWindowMs);
      }
    });

    it("古い post が revival 確率で追加される", async () => {
      const postRepo = createInMemoryPostRepository();
      // 直近3日以内 post
      await postRepo.createMany(community1.id, [
        {
          slotKey: "slot-recent",
          seq: 0,
          author: botWorker.id,
          title: "直近投稿",
          text: "本文",
          createdAt: recentDate(),
        },
      ]);
      // 3日超の古い post
      await postRepo.createMany(community1.id, [
        {
          slotKey: "slot-old",
          seq: 1,
          author: botWorker.id,
          title: "古い投稿",
          text: "本文",
          createdAt: oldDate(5),
        },
      ]);

      let capturedPrompt = "";
      const generate = vi.fn().mockImplementation(async (prompt: string) => {
        capturedPrompt = prompt;
        return { text: makeCommentOutput("ref-1") };
      });

      // revival 確率のために rng を制御: 最初の呼び出し（確率判定）で 0.05 < 0.1 → revival あり
      let rngCall = 0;
      const rng = () => {
        rngCall++;
        if (rngCall === 1) return 0.05; // 確率判定: revival あり
        if (rngCall === 2) return 0.0;  // 古い post インデックス: 0
        return 0.5;
      };

      await runCommentBatch({
        communityRepo: createInMemoryCommunityRepository([community1]),
        postRepo,
        commentRepo: createInMemoryCommentRepository(),
        workerCommunityRepo: createInMemoryWorkerCommunityRepository({
          workers: [botWorker],
          links: [{ workerId: botWorker.id, communityId: community1.id }],
        }),
        generate,
        anthropicApiKey: "test-key",
        now: NOW,
        rng,
        revivalProbability: 0.1,
      });

      // プロンプトに ref-2（revival post）が含まれること
      expect(capturedPrompt).toContain("ref-2");
      expect(capturedPrompt).toContain("古い投稿");
    });
  });

  describe("エラーハンドリング", () => {
    it("1 コミュニティが JSON パース失敗しても他のコミュニティは継続される", async () => {
      const postRepo = createInMemoryPostRepository();
      await postRepo.createMany(community1.id, [
        {
          slotKey: "slot-c1",
          seq: 0,
          author: botWorker.id,
          title: "C1投稿",
          text: "本文",
          createdAt: recentDate(),
        },
      ]);
      await postRepo.createMany(community2.id, [
        {
          slotKey: "slot-c2",
          seq: 0,
          author: botWorker.id,
          title: "C2投稿",
          text: "本文",
          createdAt: recentDate(),
        },
      ]);

      // community1（テクノロジー）は常に失敗、community2（日常）は常に成功
      // プロンプトにコミュニティ名が含まれるため識別可能
      const generate = vi.fn().mockImplementation(async (prompt: string) => {
        if (prompt.includes(community1.name)) {
          return { text: "INVALID JSON" };
        }
        return { text: makeCommentOutput("ref-1") };
      });

      const result = await runCommentBatch({
        communityRepo: createInMemoryCommunityRepository([community1, community2]),
        postRepo,
        commentRepo: createInMemoryCommentRepository(),
        workerCommunityRepo: createInMemoryWorkerCommunityRepository({
          workers: [botWorker],
          links: [
            { workerId: botWorker.id, communityId: community1.id },
            { workerId: botWorker.id, communityId: community2.id },
          ],
        }),
        generate,
        anthropicApiKey: "test-key",
        now: NOW,
        revivalProbability: 0,
      });

      // community2 のコメントは保存されている（community1 はリトライ上限到達で失敗）
      expect(result.comments.length).toBeGreaterThan(0);
      // community1: 3回（initial + 2 retries）、community2: 1回
      expect(generate).toHaveBeenCalledTimes(4);
    });

    it("成功コミュニティに BatchRunLog(success)・失敗コミュニティに BatchRunLog(failure) が記録される", async () => {
      const postRepo = createInMemoryPostRepository();
      await postRepo.createMany(community1.id, [
        {
          slotKey: "slot-c1",
          seq: 0,
          author: botWorker.id,
          title: "C1投稿",
          text: "本文",
          createdAt: recentDate(),
        },
      ]);
      await postRepo.createMany(community2.id, [
        {
          slotKey: "slot-c2",
          seq: 0,
          author: botWorker.id,
          title: "C2投稿",
          text: "本文",
          createdAt: recentDate(),
        },
      ]);

      // community1（テクノロジー）は常に失敗（リトライ上限到達）、community2（日常）は成功
      const generate = vi.fn().mockImplementation(async (prompt: string) => {
        if (prompt.includes(community1.name)) {
          return { text: "INVALID JSON" };
        }
        return { text: makeCommentOutput("ref-1") };
      });

      const batchRunLogRepo = createInMemoryBatchRunLogRepository();
      const createSpy = vi.spyOn(batchRunLogRepo, "create");

      await runCommentBatch({
        communityRepo: createInMemoryCommunityRepository([community1, community2]),
        postRepo,
        commentRepo: createInMemoryCommentRepository(),
        workerCommunityRepo: createInMemoryWorkerCommunityRepository({
          workers: [botWorker],
          links: [
            { workerId: botWorker.id, communityId: community1.id },
            { workerId: botWorker.id, communityId: community2.id },
          ],
        }),
        batchRunLogRepository: batchRunLogRepo,
        generate,
        anthropicApiKey: "test-key",
        now: NOW,
        revivalProbability: 0,
      });

      const statuses = createSpy.mock.calls.map((args) => args[0].status);
      expect(statuses).toContain("success");
      expect(statuses).toContain("failure");
    });

    it("author 検証失敗 → failure BatchRunLog に記録・コメントは保存されない", async () => {
      const postRepo = createInMemoryPostRepository();
      await postRepo.createMany(community1.id, [
        {
          slotKey: "slot-auth",
          seq: 0,
          author: botWorker.id,
          title: "投稿",
          text: "本文",
          createdAt: recentDate(),
        },
      ]);

      // 不正な author
      const invalidOutput = JSON.stringify({
        topic: "test",
        posts: [
          {
            ref: "ref-1",
            comments: [{ author: "unknown-worker-xyz", text: "コメント" }],
          },
        ],
      });
      const generate = vi.fn().mockResolvedValue({ text: invalidOutput });

      const batchRunLogRepo = createInMemoryBatchRunLogRepository();
      const createSpy = vi.spyOn(batchRunLogRepo, "create");

      const result = await runCommentBatch({
        communityRepo: createInMemoryCommunityRepository([community1]),
        postRepo,
        commentRepo: createInMemoryCommentRepository(),
        workerCommunityRepo: createInMemoryWorkerCommunityRepository({
          workers: [botWorker],
          links: [{ workerId: botWorker.id, communityId: community1.id }],
        }),
        batchRunLogRepository: batchRunLogRepo,
        generate,
        anthropicApiKey: "test-key",
        now: NOW,
        revivalProbability: 0,
      });

      expect(result.comments).toHaveLength(0);
      expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ status: "failure" }));
    });
  });

  describe("リトライ (#626)", () => {
    it("JSON パース失敗が 1 回でリトライ成功する場合、generate が 2 回呼ばれコメントが永続化される", async () => {
      const postRepo = createInMemoryPostRepository();
      await postRepo.createMany(community1.id, [
        {
          slotKey: "slot-retry",
          seq: 0,
          author: botWorker.id,
          title: "投稿",
          text: "本文",
          createdAt: recentDate(),
        },
      ]);

      const generate = vi.fn()
        .mockResolvedValueOnce({ text: "INVALID JSON" })
        .mockResolvedValueOnce({ text: makeCommentOutput("ref-1") });

      const commentRepo = createInMemoryCommentRepository();
      const result = await runCommentBatch({
        communityRepo: createInMemoryCommunityRepository([community1]),
        postRepo,
        commentRepo,
        workerCommunityRepo: createInMemoryWorkerCommunityRepository({
          workers: [botWorker],
          links: [{ workerId: botWorker.id, communityId: community1.id }],
        }),
        generate,
        anthropicApiKey: "test-key",
        now: NOW,
        revivalProbability: 0,
      });

      expect(generate).toHaveBeenCalledTimes(2);
      expect(result.comments.length).toBeGreaterThan(0);
    });

    it("リトライ上限到達（3回連続失敗）で BatchRunLog(failure) が記録されコメントは保存されない", async () => {
      const postRepo = createInMemoryPostRepository();
      await postRepo.createMany(community1.id, [
        {
          slotKey: "slot-exhaust",
          seq: 0,
          author: botWorker.id,
          title: "投稿",
          text: "本文",
          createdAt: recentDate(),
        },
      ]);

      const generate = vi.fn().mockResolvedValue({ text: "INVALID JSON" });
      const batchRunLogRepo = createInMemoryBatchRunLogRepository();
      const createSpy = vi.spyOn(batchRunLogRepo, "create");

      const result = await runCommentBatch({
        communityRepo: createInMemoryCommunityRepository([community1]),
        postRepo,
        commentRepo: createInMemoryCommentRepository(),
        workerCommunityRepo: createInMemoryWorkerCommunityRepository({
          workers: [botWorker],
          links: [{ workerId: botWorker.id, communityId: community1.id }],
        }),
        batchRunLogRepository: batchRunLogRepo,
        generate,
        anthropicApiKey: "test-key",
        now: NOW,
        revivalProbability: 0,
      });

      expect(generate).toHaveBeenCalledTimes(3);
      expect(result.comments).toHaveLength(0);
      expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ status: "failure" }));
    });

    it("スキーマ検証失敗が 1 回でリトライ成功する", async () => {
      const postRepo = createInMemoryPostRepository();
      await postRepo.createMany(community1.id, [
        {
          slotKey: "slot-schema",
          seq: 0,
          author: botWorker.id,
          title: "投稿",
          text: "本文",
          createdAt: recentDate(),
        },
      ]);

      const badSchema = JSON.stringify({ topic: "test", posts: "not-an-array" });
      const generate = vi.fn()
        .mockResolvedValueOnce({ text: badSchema })
        .mockResolvedValueOnce({ text: makeCommentOutput("ref-1") });

      const result = await runCommentBatch({
        communityRepo: createInMemoryCommunityRepository([community1]),
        postRepo,
        commentRepo: createInMemoryCommentRepository(),
        workerCommunityRepo: createInMemoryWorkerCommunityRepository({
          workers: [botWorker],
          links: [{ workerId: botWorker.id, communityId: community1.id }],
        }),
        generate,
        anthropicApiKey: "test-key",
        now: NOW,
        revivalProbability: 0,
      });

      expect(generate).toHaveBeenCalledTimes(2);
      expect(result.comments.length).toBeGreaterThan(0);
    });
  });

  describe("定数の検証", () => {
    it("COMMENT_TARGET_WINDOW_DAYS は 3 である", () => {
      expect(COMMENT_TARGET_WINDOW_DAYS).toBe(3);
    });

    it("DEFAULT_COMMENT_DRIP_WINDOW_MS は 3 時間（10800000ms）である", () => {
      expect(DEFAULT_COMMENT_DRIP_WINDOW_MS).toBe(3 * 60 * 60 * 1000);
    });
  });
});
