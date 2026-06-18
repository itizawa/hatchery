import { describe, expect, it } from "vitest";

import { createInMemoryCommentRepository } from "../persistence/commentRepository.js";
import { createInMemoryPostRepository } from "../persistence/postRepository.js";
import type { CommunityRecord } from "../persistence/communityRepository.js";

import { fetchRecentContext } from "./fetchRecentContext.js";

const now = new Date("2026-06-18T12:00:00Z");

const community: CommunityRecord = {
  id: "c1",
  slug: "tech",
  name: "Tech",
  description: "Tech discussions",
  generationInstruction: null,
  synopsis: null,
  lastSlotKey: null,
  iconUrl: null,
  coverUrl: null,
  createdAt: new Date("2026-01-01"),
};

describe("fetchRecentContext (#716)", () => {
  it("post も comment も 0 件のとき空の recentLog と空の recentPostsForReply / popularPosts を返す", async () => {
    const postRepo = createInMemoryPostRepository();
    const commentRepo = createInMemoryCommentRepository();

    const result = await fetchRecentContext({
      postRepo,
      commentRepo,
      community,
      recentLimit: 30,
      maxPostsForReply: 5,
      now,
      popularPostsWindowDays: 7,
      popularPostsMinScore: 1,
      popularPostsLimit: 3,
    });

    expect(result.recentLog).toEqual([]);
    expect(result.recentPostsForReply).toEqual([]);
    expect(result.popularPosts).toEqual([]);
  });

  it("recentPostsForReply は maxPostsForReply 件以内に収まる", async () => {
    const postRepo = createInMemoryPostRepository();
    const commentRepo = createInMemoryCommentRepository();

    // 10 件の post を作成
    for (let i = 0; i < 10; i++) {
      await postRepo.createMany(community.id, [
        {
          slotKey: `slot-${i}`,
          seq: 0,
          author: "worker1",
          title: `title-${i}`,
          text: `text-${i}`,
          createdAt: new Date(now.getTime() - i * 60000),
        },
      ]);
    }

    const result = await fetchRecentContext({
      postRepo,
      commentRepo,
      community,
      recentLimit: 30,
      maxPostsForReply: 3,
      now,
      popularPostsWindowDays: 7,
      popularPostsMinScore: 1,
      popularPostsLimit: 3,
    });

    expect(result.recentPostsForReply.length).toBeLessThanOrEqual(3);
  });

  it("recentPostsForReply の各エントリは ref / id / title を持つ", async () => {
    const postRepo = createInMemoryPostRepository();
    const commentRepo = createInMemoryCommentRepository();

    await postRepo.createMany(community.id, [
      {
        slotKey: "slot-1",
        seq: 0,
        author: "worker1",
        title: "テストタイトル",
        text: "テスト本文",
        createdAt: new Date(now.getTime() - 60000),
      },
    ]);

    const result = await fetchRecentContext({
      postRepo,
      commentRepo,
      community,
      recentLimit: 30,
      maxPostsForReply: 5,
      now,
      popularPostsWindowDays: 7,
      popularPostsMinScore: 1,
      popularPostsLimit: 3,
    });

    expect(result.recentPostsForReply).toHaveLength(1);
    expect(result.recentPostsForReply[0]).toMatchObject({
      ref: expect.stringContaining("ref-"),
      id: expect.any(String),
      title: "テストタイトル",
    });
  });

  it("popularPosts は minScore 未満の post を含まない", async () => {
    const postRepo = createInMemoryPostRepository();
    const commentRepo = createInMemoryCommentRepository();

    // score=0 の post を作成（listTopByCommunity で minScore=1 未満はフィルタされる）
    await postRepo.createMany(community.id, [
      {
        slotKey: "slot-1",
        seq: 0,
        author: "worker1",
        title: "score0 post",
        text: "text",
        createdAt: new Date(now.getTime() - 60000),
      },
    ]);

    const result = await fetchRecentContext({
      postRepo,
      commentRepo,
      community,
      recentLimit: 30,
      maxPostsForReply: 5,
      now,
      popularPostsWindowDays: 7,
      popularPostsMinScore: 1,
      popularPostsLimit: 3,
    });

    // score=0 の post は minScore=1 でフィルタされるため popularPosts に入らない
    expect(result.popularPosts).toEqual([]);
  });
});
