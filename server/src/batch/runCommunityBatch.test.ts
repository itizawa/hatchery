import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInMemoryAppSettingRepository } from "../persistence/appSettingRepository.js";
import { createInMemoryBatchRunLogRepository } from "../persistence/batchRunLogRepository.js";
import { createInMemoryCommentRepository } from "../persistence/commentRepository.js";
import { createInMemoryCommunityRepository, type CommunityRecord } from "../persistence/communityRepository.js";
import { createInMemoryPostRepository } from "../persistence/postRepository.js";
import {
  createInMemoryWorkerCommunityRepository,
  type InMemoryWorkerCommunityData,
} from "../persistence/workerCommunityRepository.js";
import type { WorkerRecord } from "../persistence/workerRepository.js";

import { runCommunityBatch } from "./runCommunityBatch.js";

/** テスト用 Bot ワーカー（フォールバック候補）。 */
const botWorkers: WorkerRecord[] = [
  { id: "haru", displayName: "haru", role: "ムードメーカー", personality: null, imageUrl: null, deletedAt: null },
  { id: "ken", displayName: "ken", role: "ベテラン", personality: null, imageUrl: null, deletedAt: null },
  { id: "mei", displayName: "mei", role: "新人", personality: null, imageUrl: null, deletedAt: null },
];

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
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const buildDeps = (
    communities: CommunityRecord[],
    workerCommunityData: InMemoryWorkerCommunityData = { workers: [], links: [] },
  ) => {
    const communityRepo = createInMemoryCommunityRepository(communities);
    const postRepo = createInMemoryPostRepository();
    const commentRepo = createInMemoryCommentRepository();
    const appSettingRepo = createInMemoryAppSettingRepository();
    const batchRunLogRepository = createInMemoryBatchRunLogRepository();
    const workerCommunityRepo = createInMemoryWorkerCommunityRepository(workerCommunityData);
    // 紐づき 0 件のフォールバック先（全 Bot ワーカー）。既存テストはここで haru/ken/mei を供給する。
    const botWorkerProvider = (): Promise<readonly WorkerRecord[]> => Promise.resolve(botWorkers);
    return {
      communityRepo,
      postRepo,
      commentRepo,
      appSettingRepo,
      batchRunLogRepository,
      workerCommunityRepo,
      botWorkerProvider,
      anthropicApiKey: "test-key",
    };
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

  it("author が未知の workerId を含む出力はスキップされる（DB 取得 id 集合で検証）", async () => {
    // community-1 に haru/ken を WorkerCommunity で紐づける（unknown-worker は含まない）
    const deps = buildDeps([community1], {
      workers: [botWorkers[0]!, botWorkers[1]!],
      links: [
        { workerId: "haru", communityId: "community-1" },
        { workerId: "ken", communityId: "community-1" },
      ],
    });
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

    const result = await runCommunityBatch({ ...deps, generate });

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
    const deps = buildDeps([community1]);
    const generate = vi.fn().mockResolvedValue(validGenerationOutput);

    const result = await runCommunityBatch({ ...deps, generate, anthropicApiKey: undefined });

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
    const deps = buildDeps([community1], {
      workers: [botWorkers[0]!],
      links: [{ workerId: "haru", communityId: "community-1" }],
    });
    const generate = vi.fn().mockResolvedValue(outputWithScore);

    const result = await runCommunityBatch({ ...deps, generate });

    expect(result.posts[0]?.score).toBe(0);
  });

  it("WorkerCommunity で紐づくワーカーが community 別にプロンプト・検証に使われる（#489 AC2/AC4）", async () => {
    // community-1 には mei だけを紐づける。mei を author にした出力は通り、
    // 紐づきの無い haru を author にした出力は検証で弾かれることで DB 取得を確認する。
    const deps = buildDeps([community1], {
      workers: [botWorkers[2]!], // mei
      links: [{ workerId: "mei", communityId: "community-1" }],
    });
    const meiOutput = JSON.stringify({
      topic: "test",
      posts: [
        { id: "p1", author: "mei", title: "新人の投稿", text: "よろしくお願いします", comments: [] },
      ],
    });
    const haruOutput = JSON.stringify({
      topic: "test",
      posts: [
        { id: "p1", author: "haru", title: "未参加ワーカー", text: "登場しないはず", comments: [] },
      ],
    });

    const okResult = await runCommunityBatch({
      ...deps,
      generate: vi.fn().mockResolvedValue(meiOutput),
      slotKey: "2026-06-13T09:00",
    });
    expect(okResult.posts.map((p) => p.author)).toEqual(["mei"]);

    const ngResult = await runCommunityBatch({
      ...deps,
      generate: vi.fn().mockResolvedValue(haruOutput),
      slotKey: "2026-06-13T12:00",
    });
    // haru は community-1 に紐づいていないため検証で弾かれる
    expect(ngResult.posts.length).toBe(0);
  });

  it("紐づくワーカーが 0 件の community は全 Bot ワーカーへフォールバックする（#489 AC3）", async () => {
    // WorkerCommunity の紐づき無し → botWorkerProvider（haru/ken/mei）が使われる
    const deps = buildDeps([community1], { workers: [], links: [] });
    const generate = vi.fn().mockResolvedValue(validGenerationOutput); // author: haru / ken

    const result = await runCommunityBatch({ ...deps, generate });

    // フォールバックで haru/ken が許可され生成される
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.posts.length).toBe(2);
  });

  it("紐づきも Bot ワーカーも 0 件の community は生成をスキップする（#489 AC3）", async () => {
    const deps = buildDeps([community1], { workers: [], links: [] });
    const generate = vi.fn().mockResolvedValue(validGenerationOutput);

    // botWorkerProvider を空に上書き（全 Bot ワーカーも 0 件）
    const result = await runCommunityBatch({
      ...deps,
      generate,
      botWorkerProvider: () => Promise.resolve([]),
    });

    // 登場ワーカーが 1 人もいないため生成しない
    expect(generate).not.toHaveBeenCalled();
    expect(result.posts.length).toBe(0);
    expect(result.comments.length).toBe(0);
  });
});
