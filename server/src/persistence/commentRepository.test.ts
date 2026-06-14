import { describe, expect, it } from "vitest";
import { createInMemoryCommentRepository } from "./commentRepository.js";

describe("createInMemoryCommentRepository", () => {
  describe("createMany", () => {
    it("複数のコメントをバルク作成できる", async () => {
      const repo = createInMemoryCommentRepository();
      const created = await repo.createMany("community-1", [
        { postId: "post-1", slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", text: "Comment 1" },
        { postId: "post-1", slotKey: "2026-06-10T09:00", seq: 1, author: "worker-2", text: "Comment 2" },
      ]);
      expect(created).toHaveLength(2);
      expect(created[0].communityId).toBe("community-1");
      expect(created[0].score).toBe(0);
    });

    it("(communityId, slotKey, seq) が重複する場合は既存を返す（Cron 二重発火ガード）", async () => {
      const repo = createInMemoryCommentRepository();
      await repo.createMany("community-1", [
        { postId: "post-1", slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", text: "Comment 1" },
      ]);
      const second = await repo.createMany("community-1", [
        { postId: "post-1", slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", text: "Comment 1" },
      ]);
      expect(second).toHaveLength(1);
      const all = await repo.listByPost("post-1");
      expect(all).toHaveLength(1);
    });
  });

  describe("listByPost", () => {
    it("post のコメントを createdAt 昇順で返す", async () => {
      const repo = createInMemoryCommentRepository();
      await repo.createMany("community-1", [
        { postId: "post-1", slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", text: "First" },
        { postId: "post-1", slotKey: "2026-06-10T09:00", seq: 1, author: "worker-2", text: "Second" },
      ]);
      const result = await repo.listByPost("post-1");
      expect(result).toHaveLength(2);
      expect(result[0].text).toBe("First");
    });

    it("別の post のコメントは含めない", async () => {
      const repo = createInMemoryCommentRepository();
      await repo.createMany("community-1", [
        { postId: "post-1", slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", text: "P1 Comment" },
        { postId: "post-2", slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", text: "P2 Comment" },
      ]);
      const result = await repo.listByPost("post-1");
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("P1 Comment");
    });
  });

  describe("countByPostIds（#500）", () => {
    it("postId ごとのコメント件数を Map で返す", async () => {
      const repo = createInMemoryCommentRepository();
      await repo.createMany("community-1", [
        { postId: "post-1", slotKey: "s", seq: 0, author: "w", text: "c1" },
        { postId: "post-1", slotKey: "s", seq: 1, author: "w", text: "c2" },
        { postId: "post-2", slotKey: "s", seq: 2, author: "w", text: "c3" },
      ]);
      const counts = await repo.countByPostIds(["post-1", "post-2"]);
      expect(counts.get("post-1")).toBe(2);
      expect(counts.get("post-2")).toBe(1);
    });

    it("コメントが無い postId は Map に現れない（呼び出し側で 0 とみなす）", async () => {
      const repo = createInMemoryCommentRepository();
      await repo.createMany("community-1", [
        { postId: "post-1", slotKey: "s", seq: 0, author: "w", text: "c1" },
      ]);
      const counts = await repo.countByPostIds(["post-1", "post-empty"]);
      expect(counts.get("post-1")).toBe(1);
      expect(counts.has("post-empty")).toBe(false);
    });

    it("空配列を渡すと空の Map を返す", async () => {
      const repo = createInMemoryCommentRepository();
      const counts = await repo.countByPostIds([]);
      expect(counts.size).toBe(0);
    });

    it("対象外の postId のコメントは数えない", async () => {
      const repo = createInMemoryCommentRepository();
      await repo.createMany("community-1", [
        { postId: "post-1", slotKey: "s", seq: 0, author: "w", text: "c1" },
        { postId: "post-other", slotKey: "s", seq: 1, author: "w", text: "c2" },
      ]);
      const counts = await repo.countByPostIds(["post-1"]);
      expect(counts.get("post-1")).toBe(1);
      expect(counts.has("post-other")).toBe(false);
    });
  });

  describe("findById", () => {
    it("存在する id で取得できる", async () => {
      const repo = createInMemoryCommentRepository();
      const [created] = await repo.createMany("community-1", [
        { postId: "post-1", slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", text: "Comment" },
      ]);
      const result = await repo.findById(created.id);
      expect(result).toMatchObject({ text: "Comment" });
    });

    it("存在しない id は null を返す", async () => {
      const repo = createInMemoryCommentRepository();
      const result = await repo.findById("not-exists");
      expect(result).toBeNull();
    });
  });

  describe("addScore", () => {
    it("score を加算できる", async () => {
      const repo = createInMemoryCommentRepository();
      const [created] = await repo.createMany("community-1", [
        { postId: "post-1", slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", text: "Comment" },
      ]);
      const updated = await repo.addScore(created.id, 1);
      expect(updated?.score).toBe(1);
    });

    it("存在しない id は null を返す", async () => {
      const repo = createInMemoryCommentRepository();
      const result = await repo.addScore("not-exists", 1);
      expect(result).toBeNull();
    });
  });
});
