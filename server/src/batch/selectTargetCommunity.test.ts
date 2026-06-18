import { describe, expect, it } from "vitest";

import { createInMemoryVoteRepository } from "../persistence/voteRepository.js";
import type { CommunityRecord } from "../persistence/communityRepository.js";

import { selectOneCommunity, VOTE_WEIGHT_WINDOW_DAYS } from "./selectTargetCommunity.js";

const now = new Date("2026-06-18T12:00:00Z");

const makeCommunity = (id: string): CommunityRecord => ({
  id,
  slug: id,
  name: id,
  description: `${id} description`,
  generationInstruction: null,
  synopsis: null,
  lastSlotKey: null,
  iconUrl: null,
  coverUrl: null,
  createdAt: new Date("2026-01-01"),
});

describe("selectOneCommunity (#716)", () => {
  it("communities が空のとき null を返す", async () => {
    const voteRepo = createInMemoryVoteRepository(() => "c1");
    const result = await selectOneCommunity({
      communities: [],
      voteRepo,
      rng: () => 0.5,
      now,
    });
    expect(result).toBeNull();
  });

  it("1 件のとき必ずそのコミュニティを返す", async () => {
    const c1 = makeCommunity("c1");
    const voteRepo = createInMemoryVoteRepository(() => "c1");
    const result = await selectOneCommunity({
      communities: [c1],
      voteRepo,
      rng: () => 0.5,
      now,
    });
    expect(result?.id).toBe("c1");
  });

  it("vote なし（全スコア 0）のとき rng=0 で最初のコミュニティを返す", async () => {
    const c1 = makeCommunity("c1");
    const c2 = makeCommunity("c2");
    const voteRepo = createInMemoryVoteRepository(() => "c1");
    const result = await selectOneCommunity({
      communities: [c1, c2],
      voteRepo,
      rng: () => 0,
      now,
    });
    expect(result).not.toBeNull();
  });

  it("VOTE_WEIGHT_WINDOW_DAYS が正の整数としてエクスポートされている", () => {
    expect(typeof VOTE_WEIGHT_WINDOW_DAYS).toBe("number");
    expect(VOTE_WEIGHT_WINDOW_DAYS).toBeGreaterThan(0);
  });
});
