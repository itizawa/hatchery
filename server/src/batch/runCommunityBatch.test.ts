import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInMemoryAppSettingRepository } from "../persistence/appSettingRepository.js";
import { createInMemoryBatchRunLogRepository } from "../persistence/batchRunLogRepository.js";
import { createInMemoryCommentRepository } from "../persistence/commentRepository.js";
import { createInMemoryCommunityRepository, type CommunityRecord } from "../persistence/communityRepository.js";
import { createInMemoryPostRepository } from "../persistence/postRepository.js";

import { runCommunityBatch } from "./runCommunityBatch.js";

/** テスト用のコミュニティ */
const community1: CommunityRecord = {
  id: "community-1",
  slug: "technology",
  name: "テクノロジー",
  description: "テクノロジーとプログラミングの話題を楽しむコミュニティ。",
  synopsis: null,
  lastSlotKey: null,
  createdAt: new Date("2026-01-01"),
};

const community2: CommunityRecord = {
  id: "community-2",
  slug: "daily",
  name: "日常",
  description: "日常のあれこれを話すコミュニティ。",
  synopsis: null,
  lastSlotKey: null,
  createdAt: new Date("2026-01-02"),
};

/** 正常な生成出力 JSON */
const validGenerationOutput = JSON.stringify({
  topic: "今日のテクノロジーニュース",
  posts: [
    {
      id: "p1",
      author: "haru",
      title: "最新のAI動向について",
      text: "最近のAI技術の進歩が目覚ましいですね。",
      comments: [
        { author: "ken", text: "本当に進歩が速いですね。" },
        { author: "haru", text: "そうですね！" },
      ],
    },
    {
      id: "p2",
      author: "ken",
      title: "プログラミング言語の選択",
      text: "TypeScript は本当に使いやすくなりました。",
      comments: [],
    },
  ],
});

describe("runCommunityBatch (#306)", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    vi.restoreAllMocks();
  });

  const buildDeps = (communities: CommunityRecord[]) => {
    const communityRepo = createInMemoryCommunityRepository(communities);
    const postRepo = createInMemoryPostRepository();
    const commentRepo = createInMemoryCommentRepository();
    const appSettingRepo = createInMemoryAppSettingRepository();
    const batchRunLogRepository = createInMemoryBatchRunLogRepository();
    return { communityRepo, postRepo, commentRepo, appSettingRepo, batchRunLogRepository };
  };

  it("正常系: community ごとに post と comment が永続化される", async () => {
    const deps = buildDeps([community1]);
    const generate = vi.fn().mockResolvedValue(validGenerationOutput);

    const result = await runCommunityBatch({ ...deps, generate });

    expect(result.posts.length).toBe(2);
    expect(result.comments.length).toBe(2);
    // post が community1 に紐づいている
    expect(result.posts[0]?.communityId).toBe("community-1");
    expect(result.posts[1]?.communityId).toBe("community-1");
    // comment が post に紐づいている
    expect(result.comments[0]?.postId).toBe(result.posts[0]?.id);
    expect(result.comments[1]?.postId).toBe(result.posts[0]?.id);
  });

  it("複数コミュニティがある場合、それぞれに generate が 1 回呼ばれる", async () => {
    const deps = buildDeps([community1, community2]);
    const generate = vi.fn().mockResolvedValue(validGenerationOutput);

    await runCommunityBatch({ ...deps, generate });

    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("author が未知の workerId を含む出力はスキップされる", async () => {
    const deps = buildDeps([community1]);
    const invalidOutput = JSON.stringify({
      topic: "test",
      posts: [
        {
          id: "p1",
          author: "unknown-worker", // 未知の workerId
          title: "テスト",
          text: "テスト本文",
          comments: [],
        },
      ],
    });
    const generate = vi.fn().mockResolvedValue(invalidOutput);

    // workers に haru, ken のみを渡す（unknown-worker は含まない）
    const result = await runCommunityBatch({
      ...deps,
      generate,
      workers: [
        { id: "haru", displayName: "haru", role: "ムードメーカー" },
        { id: "ken", displayName: "ken", role: "ベテラン" },
      ],
    });

    // 検証失敗でスキップ → 永続化されない
    expect(result.posts.length).toBe(0);
    expect(result.comments.length).toBe(0);
  });

  it("JSON パース失敗時はその community をスキップする", async () => {
    const deps = buildDeps([community1, community2]);
    const generate = vi
      .fn()
      .mockResolvedValueOnce("不正なJSON{{{") // community1: パース失敗
      .mockResolvedValueOnce(validGenerationOutput); // community2: 正常

    const result = await runCommunityBatch({ ...deps, generate });

    // community1 はスキップ、community2 は永続化
    expect(result.posts.length).toBe(2);
    expect(result.posts[0]?.communityId).toBe("community-2");
  });

  it("二重発火ガード: 同一 slotKey で 2 回実行しても 2 回目は skip される", async () => {
    const deps = buildDeps([community1]);
    const generate = vi.fn().mockResolvedValue(validGenerationOutput);
    const fixedSlotKey = "2026-06-10T09:00";

    // 1 回目
    await runCommunityBatch({ ...deps, generate, slotKey: fixedSlotKey });
    // 2 回目（同じ slotKey）
    await runCommunityBatch({ ...deps, generate, slotKey: fixedSlotKey });

    // 2 回呼ばれているが、post は 2 件のみ（2 回目は skip）
    expect(generate).toHaveBeenCalledTimes(2);
    const allPosts = await deps.postRepo.listByCommunity("community-1");
    expect(allPosts.length).toBe(2); // 2 回目で重複追加されない
  });

  it("API キー未設定の場合は何も生成せず空を返す", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const deps = buildDeps([community1]);
    const generate = vi.fn().mockResolvedValue(validGenerationOutput);

    const result = await runCommunityBatch({ ...deps, generate });

    expect(generate).not.toHaveBeenCalled();
    expect(result.posts.length).toBe(0);
    expect(result.comments.length).toBe(0);
  });

  it("community が 0 件の場合は空を返す", async () => {
    const deps = buildDeps([]);
    const generate = vi.fn().mockResolvedValue(validGenerationOutput);

    const result = await runCommunityBatch({ ...deps, generate });

    expect(generate).not.toHaveBeenCalled();
    expect(result.posts.length).toBe(0);
    expect(result.comments.length).toBe(0);
  });

  it("score は生成出力に含まれていても永続化時に 0 となる", async () => {
    const outputWithScore = JSON.stringify({
      topic: "test",
      posts: [
        {
          id: "p1",
          author: "haru",
          title: "テスト",
          text: "テスト本文",
          score: 100, // 生成出力に score が含まれていても無視する
          comments: [],
        },
      ],
    });
    const deps = buildDeps([community1]);
    const generate = vi.fn().mockResolvedValue(outputWithScore);

    const result = await runCommunityBatch({
      ...deps,
      generate,
      workers: [{ id: "haru", displayName: "haru", role: "ムードメーカー" }],
    });

    expect(result.posts[0]?.score).toBe(0);
  });
});
