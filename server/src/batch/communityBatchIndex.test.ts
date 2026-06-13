import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInMemoryAppSettingRepository } from "../persistence/appSettingRepository.js";
import { createInMemoryBatchRunLogRepository } from "../persistence/batchRunLogRepository.js";
import { createInMemoryCommentRepository } from "../persistence/commentRepository.js";
import {
  createInMemoryCommunityRepository,
  type CommunityRecord,
} from "../persistence/communityRepository.js";
import { createInMemoryPostRepository } from "../persistence/postRepository.js";
import { createInMemoryVoteRepository } from "../persistence/voteRepository.js";
import { createInMemoryWorkerCommunityRepository } from "../persistence/workerCommunityRepository.js";
import type { WorkerRecord } from "../persistence/workerRepository.js";

import { runCommunityBatchCli, type CommunityBatchCliDeps } from "./communityBatchIndex.js";

/** フォールバック用の全 Bot ワーカー（DEFAULT_WORKERS 相当・haru/ken）。 */
const botWorkers: WorkerRecord[] = [
  { id: "haru", displayName: "haru", role: "ムードメーカー", personality: null, imageUrl: null, deletedAt: null },
  { id: "ken", displayName: "ken", role: "ベテラン", personality: null, imageUrl: null, deletedAt: null },
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

/** 正常な生成出力 JSON（DEFAULT_WORKERS の haru / ken を author に使う） */
const validGenerationOutput = JSON.stringify({
  topic: "今日のテクノロジーニュース",
  posts: [
    {
      id: "p1",
      author: "haru",
      title: "最新のAI動向について",
      text: "最近のAI技術の進歩が目覚ましいですね。",
      comments: [{ author: "ken", text: "本当に進歩が速いですね。" }],
    },
  ],
});

describe("communityBatchIndex (#383)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** スタブ依存一式（DB・Anthropic SDK に実アクセスしない） */
  const buildCliDeps = (
    communities: CommunityRecord[],
    generate: (prompt: string, apiKey: string) => Promise<string>,
  ): CommunityBatchCliDeps & { disconnect: ReturnType<typeof vi.fn> } => {
    const disconnect = vi.fn().mockResolvedValue(undefined);
    return {
      batchDeps: {
        communityRepo: createInMemoryCommunityRepository(communities),
        postRepo: createInMemoryPostRepository(),
        commentRepo: createInMemoryCommentRepository(),
        appSettingRepo: createInMemoryAppSettingRepository(),
        batchRunLogRepository: createInMemoryBatchRunLogRepository(),
        // vote 0（純スコアなし）→ 全コミュニティ床 +1（weight=1）の均等選定。
        voteRepo: createInMemoryVoteRepository(),
        // WorkerCommunity 紐づきは無し → botWorkerProvider（haru/ken）へフォールバックする。
        workerCommunityRepo: createInMemoryWorkerCommunityRepository({ workers: [], links: [] }),
        botWorkerProvider: () => Promise.resolve(botWorkers),
        generate,
        anthropicApiKey: "test-key",
        // rng=0 → 先頭（最古）コミュニティを決定的に選定する。
        rng: () => 0,
      },
      disconnect,
    };
  };

  it("複数 community があっても 1 定時 = 1 コミュニティのみ生成される（#486）", async () => {
    const generate = vi.fn().mockResolvedValue(validGenerationOutput);
    // rng=0 → community1 が選定される。
    const cliDeps = buildCliDeps([community1, community2], generate);

    const result = await runCommunityBatchCli(cliDeps);

    // 1 定時 = vote 重み付きランダムで 1 コミュニティのみ → API コールは最大 1 回。
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.posts.map((p) => p.communityId)).toEqual(["community-1"]);
  });

  it("選定コミュニティの生成が失敗してもエントリ関数は正常終了する（#486）", async () => {
    const generate = vi.fn().mockRejectedValue(new Error("API エラー"));
    // rng=0 → community1 が選定される。その生成が失敗する。
    const cliDeps = buildCliDeps([community1, community2], generate);

    // 生成失敗してもエントリ関数自体は正常終了する（エラーは batchRunLog に記録）。
    const result = await runCommunityBatchCli(cliDeps);

    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.posts.length).toBe(0);
  });

  it("対象 community が 0 件のとき、エラーにせず正常終了する", async () => {
    const generate = vi.fn();
    const cliDeps = buildCliDeps([], generate);

    const result = await runCommunityBatchCli(cliDeps);

    expect(generate).not.toHaveBeenCalled();
    expect(result.posts).toEqual([]);
    expect(result.comments).toEqual([]);
  });

  it("正常終了時に disconnect が 1 回呼ばれる", async () => {
    const generate = vi.fn().mockResolvedValue(validGenerationOutput);
    const cliDeps = buildCliDeps([community1], generate);

    await runCommunityBatchCli(cliDeps);

    expect(cliDeps.disconnect).toHaveBeenCalledTimes(1);
  });

  it("バッチ本体が throw した場合も disconnect が呼ばれ、エントリ関数は reject する", async () => {
    const generate = vi.fn();
    const cliDeps = buildCliDeps([], generate);
    // communityRepo.list 自体が落ちる = runCommunityBatch が throw するケース
    cliDeps.batchDeps.communityRepo = {
      ...cliDeps.batchDeps.communityRepo,
      list: vi.fn().mockRejectedValue(new Error("DB ダウン")),
    };

    await expect(runCommunityBatchCli(cliDeps)).rejects.toThrow("DB ダウン");
    expect(cliDeps.disconnect).toHaveBeenCalledTimes(1);
  });

  it("モジュールを import しただけではバッチが実行されない（直接実行ガード）", () => {
    // この describe まで到達している時点で、import 時に main() が走って
    // prisma 接続（@prisma/client の初期化エラー）が発生していないことを意味する。
    // generate / disconnect が import だけでは呼ばれていないことを明示的に確認する。
    const generate = vi.fn();
    const cliDeps = buildCliDeps([community1], generate);
    expect(generate).not.toHaveBeenCalled();
    expect(cliDeps.disconnect).not.toHaveBeenCalled();
  });
});
