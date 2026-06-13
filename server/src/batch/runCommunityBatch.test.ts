import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInMemoryAppSettingRepository } from "../persistence/appSettingRepository.js";
import { createInMemoryBatchRunLogRepository } from "../persistence/batchRunLogRepository.js";
import { createInMemoryCommentRepository } from "../persistence/commentRepository.js";
import { createInMemoryCommunityRepository, type CommunityRecord } from "../persistence/communityRepository.js";
import { createInMemoryPostRepository } from "../persistence/postRepository.js";
import { createInMemoryVoteRepository } from "../persistence/voteRepository.js";
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
    // vote 集計（重み算出）用。既定では vote 0（純スコアなし）で全コミュニティが床 +1 のみ。
    const voteRepo = createInMemoryVoteRepository();
    // 紐づき 0 件のフォールバック先（全 Bot ワーカー）。既存テストはここで haru/ken/mei を供給する。
    const botWorkerProvider = (): Promise<readonly WorkerRecord[]> => Promise.resolve(botWorkers);
    return {
      communityRepo,
      postRepo,
      commentRepo,
      appSettingRepo,
      batchRunLogRepository,
      workerCommunityRepo,
      voteRepo,
      botWorkerProvider,
      anthropicApiKey: "test-key",
      // 既定では rng=0 → 先頭（最古）コミュニティを選定する（決定的）。
      rng: () => 0,
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

  it("複数コミュニティがあっても generate は最大 1 回だけ呼ばれる（1 コミュニティのみ選定）", async () => {
    const deps = buildDeps([community1, community2]);
    const generate = vi.fn().mockResolvedValue(validGenerationOutput);

    await runCommunityBatch({ ...deps, generate });

    // 1 定時 = vote 重み付きランダムで 1 コミュニティのみ → API コールは最大 1 回（#486 AC3）。
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("rng を固定すると決定的に選ばれたコミュニティのみ生成・永続化される", async () => {
    // vote 0 のため両コミュニティとも床 +1（weight=1）。累積: community1=[0,1), community2=[1,2)。
    // rng=0 → community1、rng=0.9 → community2。
    const generate = vi.fn().mockResolvedValue(validGenerationOutput);

    const depsA = buildDeps([community1, community2]);
    const resultA = await runCommunityBatch({ ...depsA, generate, rng: () => 0 });
    expect(resultA.posts.every((p) => p.communityId === "community-1")).toBe(true);
    expect(resultA.posts.length).toBeGreaterThan(0);

    const depsB = buildDeps([community1, community2]);
    const resultB = await runCommunityBatch({ ...depsB, generate, rng: () => 0.9 });
    expect(resultB.posts.every((p) => p.communityId === "community-2")).toBe(true);
    expect(resultB.posts.length).toBeGreaterThan(0);
  });

  it("vote の純スコアが高いコミュニティほど選ばれやすい（重み付き）", async () => {
    // community2 配下の post に多数の up vote を積み、community2 の重みを大きくする。
    const deps = buildDeps([community1, community2]);
    // community2 の post (post-c2-*) に up を 5 件入れる → 純スコア +5、床込み weight=6。
    // community1 は vote 0 → weight=1。total=7。community1=[0,1), community2=[1,7)。
    // この vote を community2 に解決するため、voteRepo は targetId→community を解く必要がある。
    // ここではバッチ側が voteRepo.netScoresByCommunitySince を呼ぶので、
    // 集計結果を返すスタブ voteRepo を注入して重みを与える。
    const stubVoteRepo = {
      ...deps.voteRepo,
      netScoresByCommunitySince: () =>
        Promise.resolve(new Map<string, number>([["community-2", 5]])),
    };
    const generate = vi.fn().mockResolvedValue(validGenerationOutput);

    // rng=0.5 → r=0.5*7=3.5 → community2（[1,7) 区間）。
    const result = await runCommunityBatch({
      ...deps,
      voteRepo: stubVoteRepo,
      generate,
      rng: () => 0.5,
    });

    expect(result.posts.every((p) => p.communityId === "community-2")).toBe(true);
  });

  it("vote 0 の新規コミュニティも床 +1 により選定対象になる", async () => {
    // community1 が高スコア（+10 → weight=11）、community2 が vote 0（weight=1）。total=12。
    // community1=[0,11), community2=[11,12)。rng=11.5/12 → community2 が選ばれる。
    const deps = buildDeps([community1, community2]);
    const stubVoteRepo = {
      ...deps.voteRepo,
      netScoresByCommunitySince: () =>
        Promise.resolve(new Map<string, number>([["community-1", 10]])),
    };
    const generate = vi.fn().mockResolvedValue(validGenerationOutput);

    const result = await runCommunityBatch({
      ...deps,
      voteRepo: stubVoteRepo,
      generate,
      rng: () => 11.5 / 12,
    });

    expect(result.posts.every((p) => p.communityId === "community-2")).toBe(true);
    expect(result.posts.length).toBeGreaterThan(0);
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

  it("選定したコミュニティの生成出力が JSON パース失敗のときは何も永続化しない", async () => {
    // rng=0 → community1 が選定される。その生成出力がパース失敗 → 永続化なし。
    const deps = buildDeps([community1, community2]);
    const generate = vi.fn().mockResolvedValue("不正なJSON{{{");

    const result = await runCommunityBatch({ ...deps, generate, rng: () => 0 });

    // 選定された 1 コミュニティのみ generate され、パース失敗で永続化されない。
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.posts.length).toBe(0);
    expect(result.comments.length).toBe(0);
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
