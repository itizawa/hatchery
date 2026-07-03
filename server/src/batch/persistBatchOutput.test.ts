import { describe, expect, it, vi } from "vitest";

import { createInMemoryCommentRepository } from "../persistence/commentRepository.js";
import { createInMemoryPostRepository } from "../persistence/postRepository.js";
import type { GenerationOutput } from "@hatchery/common";

import * as logger from "./logger.js";
import { persistBatchOutput } from "./persistBatchOutput.js";

const now = new Date("2026-06-18T12:00:00Z");
const dripWindowMs = 3 * 60 * 60 * 1000;
const rng = () => 0.5;

describe("persistBatchOutput (#716)", () => {
  it("post 1 件・comment 0 件のとき post だけ永続化される", async () => {
    const postRepo = createInMemoryPostRepository();
    const commentRepo = createInMemoryCommentRepository();

    const output: GenerationOutput = {
      topic: "テスト",
      posts: [
        {
          id: "p1",
          author: "worker1",
          title: "タイトル",
          text: "本文",
          comments: [],
        },
      ],
      replies: [],
    };

    const result = await persistBatchOutput({
      postRepo,
      commentRepo,
      communityId: "c1",
      output,
      postRefMap: new Map(),
      slotKey: "2026-06-18T12:00",
      commentSeqStart: 0,
      now,
      dripWindowMs,
      rng,
    });

    expect(result.savedPosts).toHaveLength(1);
    expect(result.savedPosts[0]!.title).toBe("タイトル");
    expect(result.savedComments).toHaveLength(0);
  });

  it("comment が 2 件のとき savedComments が 2 件返る", async () => {
    const postRepo = createInMemoryPostRepository();
    const commentRepo = createInMemoryCommentRepository();

    const output: GenerationOutput = {
      topic: "テスト",
      posts: [
        {
          id: "p1",
          author: "worker1",
          title: "タイトル",
          text: "本文",
          comments: [
            { author: "worker2", text: "コメント1" },
            { author: "worker1", text: "コメント2" },
          ],
        },
      ],
      replies: [],
    };

    const result = await persistBatchOutput({
      postRepo,
      commentRepo,
      communityId: "c1",
      output,
      postRefMap: new Map(),
      slotKey: "2026-06-18T12:00",
      commentSeqStart: 0,
      now,
      dripWindowMs,
      rng,
    });

    expect(result.savedPosts).toHaveLength(1);
    expect(result.savedComments).toHaveLength(2);
  });

  it("reply_to が有効なとき parentCommentId が設定される", async () => {
    const postRepo = createInMemoryPostRepository();
    const commentRepo = createInMemoryCommentRepository();

    const output: GenerationOutput = {
      topic: "テスト",
      posts: [
        {
          id: "p1",
          author: "worker1",
          title: "タイトル",
          text: "本文",
          comments: [
            { author: "worker2", text: "最初のコメント" },
            { author: "worker1", text: "返信", reply_to: 0 },
          ],
        },
      ],
      replies: [],
    };

    const result = await persistBatchOutput({
      postRepo,
      commentRepo,
      communityId: "c1",
      output,
      postRefMap: new Map(),
      slotKey: "2026-06-18T12:00",
      commentSeqStart: 0,
      now,
      dripWindowMs,
      rng,
    });

    expect(result.savedComments).toHaveLength(2);
    const replyComment = result.savedComments[1]!;
    const firstComment = result.savedComments[0]!;
    expect(replyComment.parentCommentId).toBe(firstComment.id);
  });

  it("reply（既存 post 宛）が postRefMap から解決されて永続化される", async () => {
    const postRepo = createInMemoryPostRepository();
    const commentRepo = createInMemoryCommentRepository();

    // 既存 post を事前に作成しておく
    const existingPosts = await postRepo.createMany("c1", [
      {
        slotKey: "old-slot",
        seq: 0,
        author: "worker1",
        title: "既存投稿",
        text: "既存本文",
        createdAt: new Date(now.getTime() - 86400000),
      },
    ]);
    const existingPostId = existingPosts[0]!.id;

    const postRefMap = new Map([["ref-1", existingPostId]]);

    const output: GenerationOutput = {
      topic: "テスト",
      posts: [
        {
          id: "p1",
          author: "worker1",
          title: "新投稿",
          text: "新本文",
          comments: [],
        },
      ],
      replies: [
        { targetPostRef: "ref-1", author: "worker2", text: "既存投稿への返信" },
      ],
    };

    const result = await persistBatchOutput({
      postRepo,
      commentRepo,
      communityId: "c1",
      output,
      postRefMap,
      slotKey: "2026-06-18T12:00",
      commentSeqStart: 0,
      now,
      dripWindowMs,
      rng,
    });

    expect(result.savedPosts).toHaveLength(1);
    // reply コメントが savedComments に含まれる
    expect(result.savedComments).toHaveLength(1);
    expect(result.savedComments[0]!.text).toBe("既存投稿への返信");
  });

  it("複数 post がある場合でも全 post / comment が返る", async () => {
    const postRepo = createInMemoryPostRepository();
    const commentRepo = createInMemoryCommentRepository();

    const output: GenerationOutput = {
      topic: "テスト",
      posts: [
        {
          id: "p1",
          author: "worker1",
          title: "投稿1",
          text: "本文1",
          comments: [{ author: "worker2", text: "コメント1" }],
        },
        {
          id: "p2",
          author: "worker2",
          title: "投稿2",
          text: "本文2",
          comments: [
            { author: "worker1", text: "コメント2" },
            { author: "worker2", text: "コメント3" },
          ],
        },
      ],
      replies: [],
    };

    const result = await persistBatchOutput({
      postRepo,
      commentRepo,
      communityId: "c1",
      output,
      postRefMap: new Map(),
      slotKey: "2026-06-18T12:00",
      commentSeqStart: 0,
      now,
      dripWindowMs,
      rng,
    });

    expect(result.savedPosts).toHaveLength(2);
    expect(result.savedComments).toHaveLength(3);
  });
});

describe("persistBatchOutput: タイトル URL 検出ログ（#1022）", () => {
  it("タイトルに URL が含まれる場合 persist_batch.title_url_detected をログ出力する", async () => {
    const postRepo = createInMemoryPostRepository();
    const commentRepo = createInMemoryCommentRepository();
    const spy = vi.spyOn(logger, "logBatchInfo").mockImplementation(() => {});

    const output: GenerationOutput = {
      topic: "テスト",
      posts: [
        {
          id: "p1",
          author: "worker1",
          title: "詳細はこちら https://example.com/article",
          text: "本文",
          comments: [],
        },
      ],
      replies: [],
    };

    await persistBatchOutput({
      postRepo,
      commentRepo,
      communityId: "c1",
      output,
      postRefMap: new Map(),
      slotKey: "2026-06-18T12:00",
      commentSeqStart: 0,
      now: new Date("2026-06-18T12:00:00Z"),
      dripWindowMs: 3 * 60 * 60 * 1000,
      rng: () => 0.5,
    });

    expect(spy).toHaveBeenCalledWith("persist_batch.title_url_detected", {
      title: "詳細はこちら https://example.com/article",
    });

    spy.mockRestore();
  });

  it("タイトルに URL が含まれない場合はログ出力しない", async () => {
    const postRepo = createInMemoryPostRepository();
    const commentRepo = createInMemoryCommentRepository();
    const spy = vi.spyOn(logger, "logBatchInfo").mockImplementation(() => {});

    const output: GenerationOutput = {
      topic: "テスト",
      posts: [
        {
          id: "p1",
          author: "worker1",
          title: "普通のタイトル",
          text: "本文",
          comments: [],
        },
      ],
      replies: [],
    };

    await persistBatchOutput({
      postRepo,
      commentRepo,
      communityId: "c1",
      output,
      postRefMap: new Map(),
      slotKey: "2026-06-18T12:00",
      commentSeqStart: 0,
      now: new Date("2026-06-18T12:00:00Z"),
      dripWindowMs: 3 * 60 * 60 * 1000,
      rng: () => 0.5,
    });

    expect(spy).not.toHaveBeenCalledWith("persist_batch.title_url_detected", expect.anything());

    spy.mockRestore();
  });
});
