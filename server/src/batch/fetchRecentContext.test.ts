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
  feedUrl: null,
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

  it("post が 1 件あるとき recentLog が空配列でなく formatRecentLog 形式（author・title・text を含む）のエントリを持つ", async () => {
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

    expect(result.recentLog).toHaveLength(1);
    // formatRecentLog の出力形式: "[community_id] author: title / text"
    expect(result.recentLog[0]).toContain("worker1");
    expect(result.recentLog[0]).toContain("テストタイトル");
    expect(result.recentLog[0]).toContain("テスト本文");
  });

  it("post と comment が混在するとき recentLog の件数が (post 数 + comment 数) に対応し内容に両方が含まれる", async () => {
    const postRepo = createInMemoryPostRepository();
    const commentRepo = createInMemoryCommentRepository();

    const posts = await postRepo.createMany(community.id, [
      {
        slotKey: "slot-1",
        seq: 0,
        author: "worker1",
        title: "投稿タイトル",
        text: "投稿本文",
        createdAt: new Date(now.getTime() - 120000),
      },
    ]);

    await commentRepo.createMany(community.id, [
      {
        postId: posts[0].id,
        slotKey: "slot-1",
        seq: 1,
        author: "worker2",
        text: "コメント本文",
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

    // 1 post + 1 comment = 2 エントリ
    expect(result.recentLog).toHaveLength(2);
    // post のエントリは title を含む
    const postEntry = result.recentLog.find((e) => e.includes("投稿タイトル"));
    expect(postEntry).toBeDefined();
    expect(postEntry).toContain("worker1");
    // comment のエントリ
    const commentEntry = result.recentLog.find((e) => e.includes("コメント本文"));
    expect(commentEntry).toBeDefined();
    expect(commentEntry).toContain("worker2");
  });

  it("recentLimit を指定するとそれ以上の件数は recentLog に返さない", async () => {
    const postRepo = createInMemoryPostRepository();
    const commentRepo = createInMemoryCommentRepository();

    // 5 件の post を作成
    const posts = await postRepo.createMany(
      community.id,
      // eslint-disable-next-line max-params
      Array.from({ length: 5 }, (_, i) => ({
        slotKey: `slot-p${i}`,
        seq: 0,
        author: "worker1",
        title: `title-${i}`,
        text: `text-${i}`,
        createdAt: new Date(now.getTime() - (i + 6) * 60000),
      })),
    );

    // 5 件の comment を作成（各 post に 1 件）
    for (let i = 0; i < 5; i++) {
      await commentRepo.createMany(community.id, [
        {
          postId: posts[i].id,
          slotKey: `slot-c${i}`,
          seq: 1,
          author: "worker2",
          text: `comment-${i}`,
          createdAt: new Date(now.getTime() - i * 60000),
        },
      ]);
    }

    const result = await fetchRecentContext({
      postRepo,
      commentRepo,
      community,
      recentLimit: 3,
      maxPostsForReply: 5,
      now,
      popularPostsWindowDays: 7,
      popularPostsMinScore: 1,
      popularPostsLimit: 3,
    });

    expect(result.recentLog.length).toBeLessThanOrEqual(3);
  });
});
