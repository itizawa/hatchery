import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInMemoryBatchRunLogRepository } from "../persistence/batchRunLogRepository.js";
import { createInMemoryCommentRepository } from "../persistence/commentRepository.js";
import {
  createInMemoryCommunityRepository,
  type CommunityRecord,
} from "../persistence/communityRepository.js";
import { createInMemoryPostRepository } from "../persistence/postRepository.js";
import { createInMemoryVoteRepository } from "../persistence/voteRepository.js";
import {
  createInMemoryWorkerCommunityRepository,
  type InMemoryWorkerCommunityData,
} from "../persistence/workerCommunityRepository.js";
import type { WorkerRecord } from "../persistence/workerRepository.js";
import { createInMemoryWorldStateRepository } from "../persistence/worldStateRepository.js";

import { generateSlotKey, runCommunityBatch } from "./runCommunityBatch.js";

/** テスト用 Bot ワーカー（フォールバック候補）。 */
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
  {
    id: "mei",
    displayName: "mei",
    role: "新人",
    personality: null,
    imageUrl: null,
    deletedAt: null,
  },
];

/** テスト用のコミュニティ */
const community1: CommunityRecord = {
  id: "community-1",
  slug: "technology",
  name: "テクノロジー",
  description: "テクノロジーとプログラミングの話題を楽しむコミュニティ。",
  generationInstruction: null,
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
  synopsis: null,
  lastSlotKey: null,
  iconUrl: null,
  coverUrl: null,
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
    const batchRunLogRepository = createInMemoryBatchRunLogRepository();
    const workerCommunityRepo = createInMemoryWorkerCommunityRepository(workerCommunityData);
    const voteRepo = createInMemoryVoteRepository();
    const botWorkerProvider = (): Promise<readonly WorkerRecord[]> => Promise.resolve(botWorkers);
    return {
      communityRepo,
      postRepo,
      commentRepo,
      batchRunLogRepository,
      workerCommunityRepo,
      voteRepo,
      botWorkerProvider,
      anthropicApiKey: "test-key",
      rng: () => 0,
    };
  };

  it("正常系: community ごとに post と comment が永続化される", async () => {
    const deps = buildDeps([community1]);
    const generate = vi.fn().mockResolvedValue({ text: validGenerationOutput });

    const result = await runCommunityBatch({ ...deps, generate });

    expect(result.posts.length).toBe(2);
    expect(result.comments.length).toBe(2);
    expect(result.posts[0]?.communityId).toBe("community-1");
    expect(result.posts[1]?.communityId).toBe("community-1");
    expect(result.comments[0]?.postId).toBe(result.posts[0]?.id);
    expect(result.comments[1]?.postId).toBe(result.posts[0]?.id);
  });

  it("複数コミュニティがあっても generate は最大 1 回だけ呼ばれる（1 コミュニティのみ選定）", async () => {
    const deps = buildDeps([community1, community2]);
    const generate = vi.fn().mockResolvedValue({ text: validGenerationOutput });

    await runCommunityBatch({ ...deps, generate });

    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("rng を固定すると決定的に選ばれたコミュニティのみ生成・永続化される", async () => {
    const generate = vi.fn().mockResolvedValue({ text: validGenerationOutput });

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
    const deps = buildDeps([community1, community2]);
    const stubVoteRepo = {
      ...deps.voteRepo,
      netScoresByCommunitySince: () =>
        Promise.resolve(new Map<string, number>([["community-2", 5]])),
    };
    const generate = vi.fn().mockResolvedValue({ text: validGenerationOutput });

    const result = await runCommunityBatch({
      ...deps,
      voteRepo: stubVoteRepo,
      generate,
      rng: () => 0.5,
    });

    expect(result.posts.every((p) => p.communityId === "community-2")).toBe(true);
  });

  it("vote 0 の新規コミュニティも床 +1 により選定対象になる", async () => {
    const deps = buildDeps([community1, community2]);
    const stubVoteRepo = {
      ...deps.voteRepo,
      netScoresByCommunitySince: () =>
        Promise.resolve(new Map<string, number>([["community-1", 10]])),
    };
    const generate = vi.fn().mockResolvedValue({ text: validGenerationOutput });

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
          author: "unknown-worker",
          title: "テスト",
          text: "テスト本文",
          comments: [],
        },
      ],
    });
    const generate = vi.fn().mockResolvedValue({ text: invalidOutput });

    const result = await runCommunityBatch({ ...deps, generate });

    expect(result.posts.length).toBe(0);
    expect(result.comments.length).toBe(0);
  });

  it("選定したコミュニティの生成出力が JSON パース失敗のときは何も永続化しない", async () => {
    const deps = buildDeps([community1, community2]);
    const generate = vi.fn().mockResolvedValue({ text: "不正なJSON{" });

    const result = await runCommunityBatch({ ...deps, generate, rng: () => 0 });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.posts.length).toBe(0);
    expect(result.comments.length).toBe(0);
  });

  it("二重発火ガード: 同一 slotKey で 2 回実行しても 2 回目は skip される", async () => {
    const deps = buildDeps([community1]);
    const generate = vi.fn().mockResolvedValue({ text: validGenerationOutput });
    const fixedSlotKey = "2026-06-10T09:00";

    await runCommunityBatch({ ...deps, generate, slotKey: fixedSlotKey });
    await runCommunityBatch({ ...deps, generate, slotKey: fixedSlotKey });

    expect(generate).toHaveBeenCalledTimes(2);
    const allPosts = await deps.postRepo.listByCommunity("community-1");
    expect(allPosts.length).toBe(2);
  });

  it("API キー未設定の場合は何も生成せず空を返す", async () => {
    const deps = buildDeps([community1]);
    const generate = vi.fn().mockResolvedValue({ text: validGenerationOutput });

    const result = await runCommunityBatch({ ...deps, generate, anthropicApiKey: undefined });

    expect(generate).not.toHaveBeenCalled();
    expect(result.posts.length).toBe(0);
    expect(result.comments.length).toBe(0);
  });

  it("community が 0 件の場合は空を返す", async () => {
    const deps = buildDeps([]);
    const generate = vi.fn().mockResolvedValue({ text: validGenerationOutput });

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
          score: 100,
          comments: [],
        },
      ],
    });
    const deps = buildDeps([community1], {
      workers: [botWorkers[0]!],
      links: [{ workerId: "haru", communityId: "community-1" }],
    });
    const generate = vi.fn().mockResolvedValue({ text: outputWithScore });

    const result = await runCommunityBatch({ ...deps, generate });

    expect(result.posts[0]?.score).toBe(0);
  });

  it("WorkerCommunity で紐づくワーカーが community 別にプロンプト・検証に使われる（#489 AC2/AC4）", async () => {
    const deps = buildDeps([community1], {
      workers: [botWorkers[2]!],
      links: [{ workerId: "mei", communityId: "community-1" }],
    });
    const meiOutput = JSON.stringify({
      topic: "test",
      posts: [
        {
          id: "p1",
          author: "mei",
          title: "新人の投稿",
          text: "よろしくお願いします",
          comments: [],
        },
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
      generate: vi.fn().mockResolvedValue({ text: meiOutput }),
      slotKey: "2026-06-13T09:00",
    });
    expect(okResult.posts.map((p) => p.author)).toEqual(["mei"]);

    const ngResult = await runCommunityBatch({
      ...deps,
      generate: vi.fn().mockResolvedValue({ text: haruOutput }),
      slotKey: "2026-06-13T12:00",
    });
    expect(ngResult.posts.length).toBe(0);
  });

  it("recentLimit を指定すると直近ログ取得件数に反映される（#389 AC2）", async () => {
    const deps = buildDeps([community1]);
    const generate = vi.fn().mockResolvedValue({ text: validGenerationOutput });
    const postSpy = vi.spyOn(deps.postRepo, "listByCommunity");
    const commentSpy = vi.spyOn(deps.commentRepo, "listByCommunity");

    await runCommunityBatch({ ...deps, generate, recentLimit: 7 });

    // #556: 第3引数に { now } が渡される（reveal フィルタ）
    expect(postSpy).toHaveBeenCalledWith("community-1", 7, expect.objectContaining({ now: expect.any(Date) }));
    expect(commentSpy).toHaveBeenCalledWith("community-1", 7, expect.objectContaining({ now: expect.any(Date) }));
  });

  it("recentLimit 未指定なら既定の 30 件で取得する（#389 AC2）", async () => {
    const deps = buildDeps([community1]);
    const generate = vi.fn().mockResolvedValue({ text: validGenerationOutput });
    const postSpy = vi.spyOn(deps.postRepo, "listByCommunity");

    await runCommunityBatch({ ...deps, generate });

    // #556: 第3引数に { now } が渡される（reveal フィルタ）
    expect(postSpy).toHaveBeenCalledWith("community-1", 30, expect.objectContaining({ now: expect.any(Date) }));
  });

  it("紐づくワーカーが 0 件の community は全 Bot ワーカーへフォールバックする（#489 AC3）", async () => {
    const deps = buildDeps([community1], { workers: [], links: [] });
    const generate = vi.fn().mockResolvedValue({ text: validGenerationOutput });

    const result = await runCommunityBatch({ ...deps, generate });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.posts.length).toBe(2);
  });

  it("紐づきも Bot ワーカーも 0 件の community は生成をスキップする（#489 AC3）", async () => {
    const deps = buildDeps([community1], { workers: [], links: [] });
    const generate = vi.fn().mockResolvedValue({ text: validGenerationOutput });

    const result = await runCommunityBatch({
      ...deps,
      generate,
      botWorkerProvider: () => Promise.resolve([]),
    });

    expect(generate).not.toHaveBeenCalled();
    expect(result.posts.length).toBe(0);
    expect(result.comments.length).toBe(0);
  });

  // #555: 既存Post へのコメント追加（reply）
  it("replies を含む出力が渡された場合、既存Post に対して commentRepo.createMany が呼ばれる（#555）", async () => {
    const deps = buildDeps([community1]);
    // まず既存 Post を作っておく（先のスロットで生成済み）
    const existingPosts = await deps.postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "haru", title: "過去の投稿", text: "過去のテキスト" },
    ]);
    const existingPostId = existingPosts[0]!.id;

    const outputWithReplies = JSON.stringify({
      topic: "今日のテクノロジーニュース",
      posts: [
        {
          id: "p1",
          author: "haru",
          title: "新規投稿",
          text: "新しいテキスト",
          comments: [],
        },
      ],
      replies: [
        { targetPostRef: "ref-1", author: "ken", text: "過去投稿への返信コメント" },
      ],
    });

    // generate の呼び出し前に postRefMap が構築されるよう、事前に既存Postを配置済み
    // runCommunityBatch 内でrecentPostsとして取得され、ref-1 -> existingPostId にマップされるはず
    const generate = vi.fn().mockResolvedValue({ text: outputWithReplies });

    const result = await runCommunityBatch({
      ...deps,
      generate,
      slotKey: "2026-06-15T09:00",
    });

    // 新規Postが1件作成される
    expect(result.posts.length).toBe(1);
    // 既存PostへのReplyコメントが作成される
    const allComments = await deps.commentRepo.listByPost(existingPostId);
    expect(allComments.length).toBe(1);
    expect(allComments[0]?.author).toBe("ken");
    expect(allComments[0]?.text).toBe("過去投稿への返信コメント");
    expect(allComments[0]?.postId).toBe(existingPostId);
    // result.comments にも含まれる
    expect(result.comments.some((c) => c.postId === existingPostId)).toBe(true);
  });

  it("replies の targetPostRef が未知の場合、その reply はスキップされる（#555）", async () => {
    const deps = buildDeps([community1]);

    const outputWithUnknownRef = JSON.stringify({
      topic: "テスト",
      posts: [
        {
          id: "p1",
          author: "haru",
          title: "新規投稿",
          text: "テスト",
          comments: [],
        },
      ],
      replies: [
        { targetPostRef: "ref-unknown", author: "ken", text: "存在しない参照への返信" },
      ],
    });

    const generate = vi.fn().mockResolvedValue({ text: outputWithUnknownRef });

    const result = await runCommunityBatch({
      ...deps,
      generate,
      slotKey: "2026-06-15T12:00",
    });

    // 新規Postは作成される
    expect(result.posts.length).toBe(1);
    // 未知参照のReplyはスキップ
    expect(result.comments.length).toBe(0);
  });

  it("直近Postがない（新規コミュニティ等）場合でも正常動作し新規Postのみ生成する（#555 AC5）", async () => {
    const deps = buildDeps([community1]);
    // postRepo に何も入っていない状態
    const generate = vi.fn().mockResolvedValue({ text: validGenerationOutput });

    const result = await runCommunityBatch({ ...deps, generate });

    expect(result.posts.length).toBe(2);
    // replies は空なのでコメントは2件（新規Post内のコメントのみ）
    expect(result.comments.length).toBe(2);
  });
});

describe("runCommunityBatch worldState 登場ローテーション (#464)", () => {
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
    const batchRunLogRepository = createInMemoryBatchRunLogRepository();
    const workerCommunityRepo = createInMemoryWorkerCommunityRepository(workerCommunityData);
    const voteRepo = createInMemoryVoteRepository();
    const worldStateRepository = createInMemoryWorldStateRepository();
    const botWorkerProvider = (): Promise<readonly WorkerRecord[]> => Promise.resolve(botWorkers);
    return {
      communityRepo,
      postRepo,
      commentRepo,
      batchRunLogRepository,
      workerCommunityRepo,
      voteRepo,
      worldStateRepository,
      botWorkerProvider,
      anthropicApiKey: "test-key",
      rng: () => 0,
    };
  };

  it("生成成功時、登場した全ワーカーの lastAppearedSlotKey が当該 slotKey に更新される", async () => {
    const deps = buildDeps([community1]);
    const generate = vi.fn().mockResolvedValue({ text: validGenerationOutput });
    const slotKey = "2026-06-13T09:00";

    await runCommunityBatch({ ...deps, generate, slotKey });

    const state = await deps.worldStateRepository.get();
    expect(state).not.toBeNull();
    expect(state?.workerStates["haru"]?.lastAppearedSlotKey).toBe(slotKey);
    expect(state?.workerStates["ken"]?.lastAppearedSlotKey).toBe(slotKey);
  });

  it("既存の lastAppearedSlotKey は今回登場したワーカーのみ更新され、他は保持される", async () => {
    const deps = buildDeps([community1]);
    await deps.worldStateRepository.upsert({
      summaryVersion: 0,
      workerStates: { mei: { lastAppearedSlotKey: "2026-06-12T09:00" } },
    });
    const generate = vi.fn().mockResolvedValue({ text: validGenerationOutput });
    const slotKey = "2026-06-13T12:00";

    await runCommunityBatch({ ...deps, generate, slotKey });

    const state = await deps.worldStateRepository.get();
    expect(state?.workerStates["haru"]?.lastAppearedSlotKey).toBe(slotKey);
    expect(state?.workerStates["ken"]?.lastAppearedSlotKey).toBe(slotKey);
    expect(state?.workerStates["mei"]?.lastAppearedSlotKey).toBe("2026-06-12T09:00");
  });

  it("生成スキップ（二重発火）時は lastAppearedSlotKey を更新しない", async () => {
    const deps = buildDeps([community1]);
    const generate = vi.fn().mockResolvedValue({ text: validGenerationOutput });
    const slotKey = "2026-06-13T15:00";

    await runCommunityBatch({ ...deps, generate, slotKey });
    const afterFirst = await deps.worldStateRepository.get();
    const updatedAtFirst = afterFirst?.updatedAt;

    await runCommunityBatch({ ...deps, generate, slotKey });
    const afterSecond = await deps.worldStateRepository.get();

    expect(afterSecond?.workerStates["haru"]?.lastAppearedSlotKey).toBe(slotKey);
    const allPosts = await deps.postRepo.listByCommunity("community-1");
    expect(allPosts.length).toBe(2);
    expect(updatedAtFirst).toBeInstanceOf(Date);
  });

  it("worldStateRepository 未注入でも従来どおり生成・永続化される（後方互換）", async () => {
    const deps = buildDeps([community1]);
    const generate = vi.fn().mockResolvedValue({ text: validGenerationOutput });

    const result = await runCommunityBatch({
      ...deps,
      worldStateRepository: undefined,
      generate,
    });

    expect(result.posts.length).toBe(2);
    expect(result.comments.length).toBe(2);
  });

  it("appearingWorkerCount で登場ワーカーを絞り、最近登場していないワーカーを優先する", async () => {
    const deps = buildDeps([community1], {
      workers: [botWorkers[0]!, botWorkers[1]!, botWorkers[2]!],
      links: [
        { workerId: "haru", communityId: "community-1" },
        { workerId: "ken", communityId: "community-1" },
        { workerId: "mei", communityId: "community-1" },
      ],
    });
    await deps.worldStateRepository.upsert({
      summaryVersion: 0,
      workerStates: { haru: { lastAppearedSlotKey: "2026-06-13T09:00" } },
    });

    let receivedPrompt = "";
    const generate = vi.fn().mockImplementation((prompt: string) => {
      receivedPrompt = prompt;
      return Promise.resolve({
        text: JSON.stringify({
          topic: "rotation",
          posts: [
            { id: "p1", author: "ken", title: "t", text: "x", comments: [] },
            { id: "p2", author: "mei", title: "t2", text: "y", comments: [] },
          ],
        }),
      });
    });

    const result = await runCommunityBatch({
      ...deps,
      generate,
      appearingWorkerCount: 2,
      slotKey: "2026-06-13T12:00",
    });

    expect(receivedPrompt).toContain("ken");
    expect(receivedPrompt).toContain("mei");
    expect(receivedPrompt).not.toContain("haru");
    expect(result.posts.map((p) => p.author).sort()).toEqual(["ken", "mei"]);

    const state = await deps.worldStateRepository.get();
    expect(state?.workerStates["ken"]?.lastAppearedSlotKey).toBe("2026-06-13T12:00");
    expect(state?.workerStates["mei"]?.lastAppearedSlotKey).toBe("2026-06-13T12:00");
    expect(state?.workerStates["haru"]?.lastAppearedSlotKey).toBe("2026-06-13T09:00");
  });
});

describe("runCommunityBatch ドリップ割当（#556）", () => {
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
    const batchRunLogRepository = createInMemoryBatchRunLogRepository();
    const workerCommunityRepo = createInMemoryWorkerCommunityRepository(workerCommunityData);
    const voteRepo = createInMemoryVoteRepository();
    const botWorkerProvider = (): Promise<readonly WorkerRecord[]> => Promise.resolve(botWorkers);
    return {
      communityRepo,
      postRepo,
      commentRepo,
      batchRunLogRepository,
      workerCommunityRepo,
      voteRepo,
      botWorkerProvider,
      anthropicApiKey: "test-key",
      rng: () => 0.5,
    };
  };

  it("コメントの createdAt がスロット時刻以降・now + dripWindowMs 未満に割り当てられる", async () => {
    const deps = buildDeps([community1]);
    const generate = vi.fn().mockResolvedValue({ text: validGenerationOutput });
    const slotNow = new Date("2026-06-15T09:00:00Z");
    const dripWindowMs = 3 * 60 * 60 * 1000; // 3h

    const result = await runCommunityBatch({
      ...deps,
      generate,
      now: slotNow,
      dripWindowMs,
      slotKey: "2026-06-15T09:00",
    });

    expect(result.comments.length).toBeGreaterThan(0);
    for (const comment of result.comments) {
      expect(comment.createdAt.getTime()).toBeGreaterThanOrEqual(slotNow.getTime());
      expect(comment.createdAt.getTime()).toBeLessThan(slotNow.getTime() + dripWindowMs);
    }
  });

  it("Post の createdAt はスロット時刻（即時公開）に設定される", async () => {
    const deps = buildDeps([community1]);
    const generate = vi.fn().mockResolvedValue({ text: validGenerationOutput });
    const slotNow = new Date("2026-06-15T09:00:00Z");
    const dripWindowMs = 3 * 60 * 60 * 1000;

    const result = await runCommunityBatch({
      ...deps,
      generate,
      now: slotNow,
      dripWindowMs,
      slotKey: "2026-06-15T09:00",
    });

    expect(result.posts.length).toBeGreaterThan(0);
    for (const post of result.posts) {
      // Post は slotNow 以降に設定される（ステージング後に付与）
      expect(post.createdAt.getTime()).toBeGreaterThanOrEqual(slotNow.getTime());
    }
  });

  it("コメントの createdAt は単調増加する（post内）", async () => {
    const deps = buildDeps([community1]);
    const generate = vi.fn().mockResolvedValue({ text: validGenerationOutput });
    const slotNow = new Date("2026-06-15T09:00:00Z");

    const result = await runCommunityBatch({
      ...deps,
      generate,
      now: slotNow,
      slotKey: "2026-06-15T09:00",
    });

    // 同一 postId のコメントが単調増加しているか検証
    const commentsByPost = new Map<string, typeof result.comments>();
    for (const c of result.comments) {
      if (!commentsByPost.has(c.postId)) commentsByPost.set(c.postId, []);
      commentsByPost.get(c.postId)!.push(c);
    }
    for (const comments of commentsByPost.values()) {
      for (let i = 1; i < comments.length; i++) {
        expect(comments[i]!.createdAt.getTime()).toBeGreaterThanOrEqual(
          comments[i - 1]!.createdAt.getTime(),
        );
      }
    }
  });

  it("バッチのコンテキスト構築（listByCommunity）が now フィルタで未解禁コメントを除外する", async () => {
    const deps = buildDeps([community1]);
    const generate = vi.fn().mockResolvedValue({ text: validGenerationOutput });
    const slotNow = new Date("2026-06-15T09:00:00Z");

    // listByCommunity のスパイを仕掛けて now が渡されているか確認
    const commentListSpy = vi.spyOn(deps.commentRepo, "listByCommunity");

    await runCommunityBatch({
      ...deps,
      generate,
      now: slotNow,
      slotKey: "2026-06-15T09:00",
    });

    // now が渡されていること（reveal フィルタが有効）を確認
    expect(commentListSpy).toHaveBeenCalledWith(
      "community-1",
      expect.any(Number),
      expect.objectContaining({ now: slotNow }),
    );
  });
});

describe("runCommunityBatch 人気トピック還元 (#558)", () => {
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
    const batchRunLogRepository = createInMemoryBatchRunLogRepository();
    const workerCommunityRepo = createInMemoryWorkerCommunityRepository(workerCommunityData);
    const voteRepo = createInMemoryVoteRepository();
    const botWorkerProvider = (): Promise<readonly WorkerRecord[]> => Promise.resolve(botWorkers);
    return {
      communityRepo,
      postRepo,
      commentRepo,
      batchRunLogRepository,
      workerCommunityRepo,
      voteRepo,
      botWorkerProvider,
      anthropicApiKey: "test-key",
      rng: () => 0,
    };
  };

  it("postRepo.listTopByCommunity が呼ばれる（人気トピック取得）", async () => {
    const deps = buildDeps([community1]);
    const generate = vi.fn().mockResolvedValue({ text: validGenerationOutput });
    const listTopSpy = vi.spyOn(deps.postRepo, "listTopByCommunity");

    await runCommunityBatch({ ...deps, generate });

    expect(listTopSpy).toHaveBeenCalledTimes(1);
    expect(listTopSpy).toHaveBeenCalledWith("community-1", expect.objectContaining({
      minScore: expect.any(Number),
      limit: expect.any(Number),
      since: expect.any(Date),
    }));
  });

  it("スコアの高い post がある場合、プロンプトに人気トピックセクションが含まれる", async () => {
    const deps = buildDeps([community1]);

    // 直前にスコア付きの post を作成
    const [p1] = await deps.postRepo.createMany("community-1", [
      { slotKey: "prev-slot", seq: 0, author: "haru", title: "注目の人気投稿", text: "本文" },
    ]);
    await deps.postRepo.addScore(p1.id, 5);

    let capturedPrompt = "";
    const captureGenerate = vi.fn().mockImplementation((prompt: string) => {
      capturedPrompt = prompt;
      return Promise.resolve({ text: validGenerationOutput });
    });

    await runCommunityBatch({ ...deps, generate: captureGenerate });

    expect(capturedPrompt).toContain("特に反応が良かった投稿");
    expect(capturedPrompt).toContain("注目の人気投稿");
  });

  it("スコアの高い post がない場合、プロンプトに人気トピックセクションが含まれない", async () => {
    const deps = buildDeps([community1]);

    let capturedPrompt = "";
    const captureGenerate = vi.fn().mockImplementation((prompt: string) => {
      capturedPrompt = prompt;
      return Promise.resolve({ text: validGenerationOutput });
    });

    await runCommunityBatch({ ...deps, generate: captureGenerate });

    expect(capturedPrompt).not.toContain("特に反応が良かった投稿");
  });
});

describe("generateSlotKey (#469)", () => {
  it("UTC 固定日時から UTC 基準の slot_key を生成する", () => {
    const utcDate = new Date("2026-06-10T09:30:00Z");
    expect(generateSlotKey(utcDate)).toBe("2026-06-10T09:30");
  });

  it("UTC 真夜中はゼロ埋めされた slot_key を返す", () => {
    const utcDate = new Date("2026-01-01T00:00:00Z");
    expect(generateSlotKey(utcDate)).toBe("2026-01-01T00:00");
  });

  it("UTC とローカル時刻で日付が異なる場合も UTC 日付で返す", () => {
    const date = new Date("2026-06-09T23:30:00Z");
    expect(generateSlotKey(date)).toBe("2026-06-09T23:30");
  });
});

describe("runCommunityBatch post/comment 件数揺らぎ（#557）", () => {
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
    const batchRunLogRepository = createInMemoryBatchRunLogRepository();
    const workerCommunityRepo = createInMemoryWorkerCommunityRepository(workerCommunityData);
    const voteRepo = createInMemoryVoteRepository();
    const botWorkerProvider = (): Promise<readonly WorkerRecord[]> => Promise.resolve(botWorkers);
    return {
      communityRepo,
      postRepo,
      commentRepo,
      batchRunLogRepository,
      workerCommunityRepo,
      voteRepo,
      botWorkerProvider,
      anthropicApiKey: "test-key",
      rng: () => 0,
    };
  };

  it("postRange / commentRange を指定すると、プロンプトに件数指示が含まれる（rng 固定で決定的）", async () => {
    const deps = buildDeps([community1]);
    let receivedPrompt = "";
    const generate = vi.fn().mockImplementation((prompt: string) => {
      receivedPrompt = prompt;
      return Promise.resolve({ text: validGenerationOutput });
    });

    await runCommunityBatch({
      ...deps,
      generate,
      // rng = 0 のとき postCount = postRange.min = 2, commentCount = commentRange.min = 1
      rng: () => 0,
      postRange: { min: 2, max: 4 },
      commentRange: { min: 1, max: 3 },
    });

    // プロンプトに post 数 (2) とコメント数 (1) の指示が含まれる
    expect(receivedPrompt).toContain("2");
    expect(receivedPrompt).toContain("1");
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("postRange / commentRange 未指定でも従来どおり生成・永続化される（後方互換）", async () => {
    const deps = buildDeps([community1]);
    const generate = vi.fn().mockResolvedValue({ text: validGenerationOutput });

    const result = await runCommunityBatch({ ...deps, generate });

    expect(result.posts.length).toBe(2);
    expect(result.comments.length).toBe(2);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("rng を変えると countHints が変わる（rng=0 と rng=0.9999 でプロンプト内容が異なる）", async () => {
    const depsA = buildDeps([community1]);
    let promptA = "";
    await runCommunityBatch({
      ...depsA,
      generate: vi.fn().mockImplementation((p: string) => { promptA = p; return Promise.resolve({ text: validGenerationOutput }); }),
      rng: () => 0,
      postRange: { min: 1, max: 5 },
      commentRange: { min: 1, max: 5 },
    });

    const depsB = buildDeps([community1]);
    let promptB = "";
    await runCommunityBatch({
      ...depsB,
      generate: vi.fn().mockImplementation((p: string) => { promptB = p; return Promise.resolve({ text: validGenerationOutput }); }),
      rng: () => 0.9999,
      postRange: { min: 1, max: 5 },
      commentRange: { min: 1, max: 5 },
    });

    // rng=0 → postCount=1, rng=0.9999 → postCount=5、プロンプトが異なる
    expect(promptA).not.toBe(promptB);
  });

  it("既存の generateCountHints の結果がハード制約にならず、生成件数が異なっても永続化される", async () => {
    const deps = buildDeps([community1]);
    // postRange.min=3, max=3 のとき、プロンプトでは「3件」を指示するが、
    // AI が 2 件しか返しても（validGenerationOutput は 2 件）永続化される
    const generate = vi.fn().mockResolvedValue({ text: validGenerationOutput });

    const result = await runCommunityBatch({
      ...deps,
      generate,
      postRange: { min: 3, max: 3 },
      commentRange: { min: 3, max: 3 },
    });

    // AI が 2 件返しても永続化される（ハード制約にしない）
    expect(result.posts.length).toBe(2);
    expect(result.comments.length).toBe(2);
  });
});

describe("runCommunityBatch トークン使用量記録 (#663)", () => {
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
    const batchRunLogRepository = createInMemoryBatchRunLogRepository();
    const workerCommunityRepo = createInMemoryWorkerCommunityRepository(workerCommunityData);
    const voteRepo = createInMemoryVoteRepository();
    const botWorkerProvider = (): Promise<readonly WorkerRecord[]> => Promise.resolve(botWorkers);
    return {
      communityRepo,
      postRepo,
      commentRepo,
      batchRunLogRepository,
      workerCommunityRepo,
      voteRepo,
      botWorkerProvider,
      anthropicApiKey: "test-key",
      rng: () => 0,
    };
  };

  it("generate が usage を返したとき tokenUsageLogRepository.create が正しい引数で呼ばれる", async () => {
    const deps = buildDeps([community1]);
    const tokenUsageLogRepository = {
      create: vi.fn().mockResolvedValue({
        id: "log-1",
        occurredAt: new Date(),
        model: "claude-sonnet-4-6",
        inputTokens: 100,
        outputTokens: 200,
        batchRunLogId: null,
      }),
      findRecent: vi.fn(),
      summarize: vi.fn(),
    };
    const generate = vi.fn().mockResolvedValue({
      text: validGenerationOutput,
      inputTokens: 100,
      outputTokens: 200,
      model: "claude-sonnet-4-6",
    });

    await runCommunityBatch({ ...deps, generate, tokenUsageLogRepository });

    expect(tokenUsageLogRepository.create).toHaveBeenCalledOnce();
    expect(tokenUsageLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-4-6",
        inputTokens: 100,
        outputTokens: 200,
        batchRunLogId: expect.any(String),
      }),
    );
  });

  it("tokenUsageLogRepository 未注入のとき create は呼ばれない", async () => {
    const deps = buildDeps([community1]);
    const tokenUsageLogRepository = {
      create: vi.fn(),
      findRecent: vi.fn(),
      summarize: vi.fn(),
    };
    const generate = vi.fn().mockResolvedValue({
      text: validGenerationOutput,
      inputTokens: 100,
      outputTokens: 200,
      model: "claude-sonnet-4-6",
    });

    await runCommunityBatch({ ...deps, generate });

    expect(tokenUsageLogRepository.create).not.toHaveBeenCalled();
  });

  it("generate が usage を持たない（inputTokens 未定義）とき create は呼ばれない", async () => {
    const deps = buildDeps([community1]);
    const tokenUsageLogRepository = {
      create: vi.fn(),
      findRecent: vi.fn(),
      summarize: vi.fn(),
    };
    const generate = vi.fn().mockResolvedValue({
      text: validGenerationOutput,
    });

    await runCommunityBatch({ ...deps, generate, tokenUsageLogRepository });

    expect(tokenUsageLogRepository.create).not.toHaveBeenCalled();
  });

  it("API キー未設定のスキップ時は create が呼ばれない", async () => {
    const deps = buildDeps([community1]);
    const tokenUsageLogRepository = {
      create: vi.fn(),
      findRecent: vi.fn(),
      summarize: vi.fn(),
    };
    const generate = vi.fn().mockResolvedValue({
      text: validGenerationOutput,
      inputTokens: 10,
      outputTokens: 20,
      model: "claude-sonnet-4-6",
    });

    await runCommunityBatch({ ...deps, generate, anthropicApiKey: undefined, tokenUsageLogRepository });

    expect(tokenUsageLogRepository.create).not.toHaveBeenCalled();
  });

  it("community 0 件のスキップ時は create が呼ばれない", async () => {
    const deps = buildDeps([]);
    const tokenUsageLogRepository = {
      create: vi.fn(),
      findRecent: vi.fn(),
      summarize: vi.fn(),
    };
    const generate = vi.fn().mockResolvedValue({
      text: validGenerationOutput,
      inputTokens: 10,
      outputTokens: 20,
      model: "claude-sonnet-4-6",
    });

    await runCommunityBatch({ ...deps, generate, tokenUsageLogRepository });

    expect(tokenUsageLogRepository.create).not.toHaveBeenCalled();
  });
});
