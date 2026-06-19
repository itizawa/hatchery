import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createPrismaViewRepository } from "./prismaViewRepository.js";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("createPrismaViewRepository (integration)", () => {
  let prisma: PrismaClient;
  let communityId: string;
  let postId: string;
  let commentId: string;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.pageView.deleteMany();
    await prisma.community.deleteMany();
  });

  async function setupFixtures() {
    const c = await prisma.community.create({
      data: { slug: "view-int", name: "View Int", description: "view integration" },
    });
    communityId = c.id;
    const p = await prisma.post.create({
      data: { communityId, slotKey: "2026-06-19T09:00", seq: 0, author: "w1", title: "t1", text: "x1" },
    });
    const cm = await prisma.comment.create({
      data: { communityId, postId: p.id, slotKey: "2026-06-19T09:00", seq: 0, author: "w2", text: "c1" },
    });
    postId = p.id;
    commentId = cm.id;
  }

  describe("recordPostView", () => {
    it("新規セッションは isNew=true かつ viewCount が +1 される", async () => {
      await setupFixtures();
      const repo = createPrismaViewRepository(prisma);

      const result = await repo.recordPostView(postId, "sess-1", null);

      expect(result.isNew).toBe(true);
      const post = await prisma.post.findUnique({ where: { id: postId } });
      expect(post?.viewCount).toBe(1);
    });

    it("同一 (postId, sessionId) の二重呼び出しは isNew=false かつ viewCount が増えない", async () => {
      await setupFixtures();
      const repo = createPrismaViewRepository(prisma);

      await repo.recordPostView(postId, "sess-1", null);
      const result = await repo.recordPostView(postId, "sess-1", null);

      expect(result.isNew).toBe(false);
      const post = await prisma.post.findUnique({ where: { id: postId } });
      expect(post?.viewCount).toBe(1);
    });
  });

  describe("recordCommentViews", () => {
    it("新規セッションは newCount がコメント数と等しく viewCount が増える", async () => {
      await setupFixtures();
      const repo = createPrismaViewRepository(prisma);

      const result = await repo.recordCommentViews([commentId], "sess-1", null);

      expect(result.newCount).toBe(1);
      const comment = await prisma.comment.findUnique({ where: { id: commentId } });
      expect(comment?.viewCount).toBe(1);
    });

    it("同一 (commentId, sessionId) の二重呼び出しは newCount=0 かつ viewCount が増えない", async () => {
      await setupFixtures();
      const repo = createPrismaViewRepository(prisma);

      await repo.recordCommentViews([commentId], "sess-1", null);
      const result = await repo.recordCommentViews([commentId], "sess-1", null);

      expect(result.newCount).toBe(0);
      const comment = await prisma.comment.findUnique({ where: { id: commentId } });
      expect(comment?.viewCount).toBe(1);
    });

    it("空配列は newCount=0 を返す", async () => {
      await setupFixtures();
      const repo = createPrismaViewRepository(prisma);

      const result = await repo.recordCommentViews([], "sess-1", null);
      expect(result.newCount).toBe(0);
    });
  });

  describe("viewsByWorkerSince", () => {
    it("since より後の閲覧が author で集計される", async () => {
      await setupFixtures();
      const repo = createPrismaViewRepository(prisma);

      await repo.recordPostView(postId, "sess-1", null);
      await repo.recordPostView(postId, "sess-2", null);

      const since = new Date(Date.now() - 10000);
      const result = await repo.viewsByWorkerSince(since);

      expect(result.get("w1")).toBe(2);
    });

    it("記録がない場合は空の Map を返す", async () => {
      await setupFixtures();
      const repo = createPrismaViewRepository(prisma);

      const result = await repo.viewsByWorkerSince(new Date());
      expect(result.size).toBe(0);
    });
  });
});
