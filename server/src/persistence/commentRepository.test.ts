import { describe, expect, it } from "vitest";
import { createInMemoryCommentRepository } from "./commentRepository.js";

describe("createInMemoryCommentRepository", () => {
  describe("createMany", () => {
    it("入力した件数のコメントが作成される", async () => {
      const repo = createInMemoryCommentRepository();
      const inputs = [
        { postId: "post-1", slotKey: "morning", seq: 0, author: "worker-1", text: "Hello" },
        { postId: "post-1", slotKey: "morning", seq: 1, author: "worker-2", text: "World" },
      ];
      const result = await repo.createMany("community-1", inputs);
      expect(result).toHaveLength(2);
    });

    it("返却された CommentRecord は入力値を反映している", async () => {
      const repo = createInMemoryCommentRepository();
      const [comment] = await repo.createMany("community-1", [
        { postId: "post-1", slotKey: "morning", seq: 0, author: "worker-1", text: "Hello" },
      ]);
      expect(comment!.text).toBe("Hello");
      expect(comment!.author).toBe("worker-1");
      expect(comment!.communityId).toBe("community-1");
      expect(comment!.score).toBe(0);
    });

    it("createdAt を指定すると反映される", async () => {
      const repo = createInMemoryCommentRepository();
      const createdAt = new Date("2024-06-01T00:00:00Z");
      const [comment] = await repo.createMany("community-1", [
        { postId: "post-1", slotKey: "morning", seq: 0, author: "worker-1", text: "Hello", createdAt },
      ]);
      expect(comment!.createdAt).toEqual(createdAt);
    });
  });

  describe("listByPost", () => {
    it("指定した postId に紐づくコメントのみ返す", async () => {
      const repo = createInMemoryCommentRepository();
      await repo.createMany("community-1", [
        { postId: "post-1", slotKey: "morning", seq: 0, author: "worker-1", text: "For post 1" },
        { postId: "post-2", slotKey: "morning", seq: 1, author: "worker-2", text: "For post 2" },
      ]);
      const result = await repo.listByPost({ postId: "post-1" });
      expect(result).toHaveLength(1);
      expect(result[0]!.text).toBe("For post 1");
    });

    it("該当なしのとき空配列を返す", async () => {
      const repo = createInMemoryCommentRepository();
      const result = await repo.listByPost({ postId: "nonexistent" });
      expect(result).toHaveLength(0);
    });
  });

  describe("listByCommunity", () => {
    it("指定した communityId に紐づくコメントのみ返す", async () => {
      const repo = createInMemoryCommentRepository();
      await repo.createMany("community-1", [
        { postId: "post-1", slotKey: "morning", seq: 0, author: "worker-1", text: "For community 1" },
      ]);
      await repo.createMany("community-2", [
        { postId: "post-2", slotKey: "morning", seq: 0, author: "worker-2", text: "For community 2" },
      ]);
      const result = await repo.listByCommunity("community-1");
      expect(result).toHaveLength(1);
      expect(result[0]!.text).toBe("For community 1");
    });

    it("limit を指定すると末尾 N 件を返す", async () => {
      const repo = createInMemoryCommentRepository();
      await repo.createMany("community-1", [
        { postId: "p", slotKey: "s", seq: 0, author: "w", text: "first" },
        { postId: "p", slotKey: "s", seq: 1, author: "w", text: "second" },
        { postId: "p", slotKey: "s", seq: 2, author: "w", text: "third" },
      ]);
      const result = await repo.listByCommunity("community-1", 2);
      expect(result).toHaveLength(2);
    });

    it("maxCreatedAt より新しいコメントは除外される", async () => {
      const repo = createInMemoryCommentRepository();
      const past = new Date("2024-01-01T00:00:00Z");
      const future = new Date("2099-01-01T00:00:00Z");
      await repo.createMany("community-1", [
        { postId: "p", slotKey: "s", seq: 0, author: "w", text: "past", createdAt: past },
        { postId: "p", slotKey: "s", seq: 1, author: "w", text: "future", createdAt: future },
      ]);
      const result = await repo.listByCommunity("community-1", undefined, { maxCreatedAt: new Date("2024-06-01") });
      expect(result).toHaveLength(1);
      expect(result[0]!.text).toBe("past");
    });
  });

  describe("addScore", () => {
    it("存在するコメントのスコアが加算される", async () => {
      const repo = createInMemoryCommentRepository();
      const [comment] = await repo.createMany("community-1", [
        { postId: "post-1", slotKey: "morning", seq: 0, author: "worker-1", text: "Hello" },
      ]);
      const updated = await repo.addScore({ id: comment!.id, delta: 3 });
      expect(updated!.score).toBe(3);
    });

    it("存在しない id のとき null を返す", async () => {
      const repo = createInMemoryCommentRepository();
      const result = await repo.addScore({ id: "nonexistent", delta: 1 });
      expect(result).toBeNull();
    });
  });

  describe("updateParentCommentId", () => {
    it("存在するコメントの parentCommentId が更新される", async () => {
      const repo = createInMemoryCommentRepository();
      const [comment] = await repo.createMany("community-1", [
        { postId: "post-1", slotKey: "morning", seq: 0, author: "worker-1", text: "Child" },
      ]);
      const updated = await repo.updateParentCommentId!(comment!.id, "parent-id");
      expect(updated!.parentCommentId).toBe("parent-id");
    });

    it("存在しない id のとき null を返す", async () => {
      const repo = createInMemoryCommentRepository();
      const result = await repo.updateParentCommentId!("nonexistent", null);
      expect(result).toBeNull();
    });
  });

  describe("listByPost — parentCommentId 解決", () => {
    it("parentCommentId を持つコメントが取得できる", async () => {
      const repo = createInMemoryCommentRepository();
      const [parent, child] = await repo.createMany("community-1", [
        { postId: "post-1", slotKey: "morning", seq: 0, author: "worker-1", text: "parent" },
        { postId: "post-1", slotKey: "morning", seq: 1, author: "worker-2", text: "child" },
      ]);
      await repo.updateParentCommentId!(child!.id, parent!.id);
      const result = await repo.listByPost({ postId: "post-1" });
      const childResult = result.find((c) => c.id === child!.id);
      expect(childResult!.parentCommentId).toBe(parent!.id);
    });
  });

  describe("listByCommunity — addScore 反映確認", () => {
    it("addScore 後に listByCommunity を呼ぶとスコアが反映される", async () => {
      const repo = createInMemoryCommentRepository();
      const [comment] = await repo.createMany("community-1", [
        { postId: "post-1", slotKey: "morning", seq: 0, author: "worker-1", text: "Hello" },
      ]);
      await repo.addScore({ id: comment!.id, delta: 5 });
      const result = await repo.listByCommunity("community-1");
      expect(result).toHaveLength(1);
      expect(result[0]!.score).toBe(5);
    });
  });

  describe("listByPost — 複数投稿のコメント", () => {
    it("異なる postId のコメントが混在しても正しく絞り込まれる", async () => {
      const repo = createInMemoryCommentRepository();
      await repo.createMany("community-1", [
        { postId: "post-A", slotKey: "s", seq: 0, author: "w", text: "A1" },
        { postId: "post-B", slotKey: "s", seq: 1, author: "w", text: "B1" },
        { postId: "post-A", slotKey: "s", seq: 2, author: "w", text: "A2" },
      ]);
      const result = await repo.listByPost({ postId: "post-A" });
      expect(result).toHaveLength(2);
    });
  });

  describe("listByWorker (#690)", () => {
    it("コメントが 0 件のとき空配列と nextCursor null を返す", async () => {
      const repo = createInMemoryCommentRepository();
      const result = await repo.listByWorker({ workerId: "worker-1" });
      expect(result.comments).toHaveLength(0);
      expect(result.nextCursor).toBeNull();
    });

    it("worker のコメントを createdAt 降順で返す", async () => {
      const repo = createInMemoryCommentRepository();
      await repo.createMany("community-1", [
        { postId: "post-1", slotKey: "s", seq: 0, author: "worker-1", text: "older", createdAt: new Date("2024-01-01T00:00:00Z") },
        { postId: "post-1", slotKey: "s", seq: 1, author: "worker-1", text: "newer", createdAt: new Date("2024-06-01T00:00:00Z") },
      ]);
      const result = await repo.listByWorker({ workerId: "worker-1" });
      expect(result.comments[0]!.text).toBe("newer");
      expect(result.comments[1]!.text).toBe("older");
      expect(result.nextCursor).toBeNull();
    });

    it("別の worker のコメントは含まない", async () => {
      const repo = createInMemoryCommentRepository();
      await repo.createMany("community-1", [
        { postId: "post-1", slotKey: "s", seq: 0, author: "worker-1", text: "w1 comment" },
        { postId: "post-1", slotKey: "s", seq: 1, author: "worker-2", text: "w2 comment" },
      ]);
      const result = await repo.listByWorker({ workerId: "worker-1" });
      expect(result.comments).toHaveLength(1);
      expect(result.comments[0]!.text).toBe("w1 comment");
    });

    it("limit を超えるコメントがある場合は nextCursor を返す", async () => {
      const repo = createInMemoryCommentRepository();
      await repo.createMany("community-1", [
        { postId: "p", slotKey: "s", seq: 0, author: "worker-1", text: "c0", createdAt: new Date("2024-01-01") },
        { postId: "p", slotKey: "s", seq: 1, author: "worker-1", text: "c1", createdAt: new Date("2024-02-01") },
        { postId: "p", slotKey: "s", seq: 2, author: "worker-1", text: "c2", createdAt: new Date("2024-03-01") },
      ]);
      const result = await repo.listByWorker({ workerId: "worker-1", limit: 2 });
      expect(result.comments).toHaveLength(2);
      expect(result.nextCursor).not.toBeNull();
    });

    it("cursor を指定すると続きのコメントを返す（カーソルページネーション）", async () => {
      const repo = createInMemoryCommentRepository();
      await repo.createMany("community-1", [
        { postId: "p", slotKey: "s", seq: 0, author: "worker-1", text: "oldest", createdAt: new Date("2024-01-01") },
        { postId: "p", slotKey: "s", seq: 1, author: "worker-1", text: "middle", createdAt: new Date("2024-04-01") },
        { postId: "p", slotKey: "s", seq: 2, author: "worker-1", text: "newest", createdAt: new Date("2024-07-01") },
      ]);
      const page1 = await repo.listByWorker({ workerId: "worker-1", limit: 2 });
      expect(page1.comments.map((c) => c.text)).toEqual(["newest", "middle"]);
      expect(page1.nextCursor).not.toBeNull();

      const page2 = await repo.listByWorker({ workerId: "worker-1", limit: 2, cursor: page1.nextCursor! });
      expect(page2.comments.map((c) => c.text)).toEqual(["oldest"]);
      expect(page2.nextCursor).toBeNull();
    });

    it("存在しない cursor を指定するとエラーを投げる", async () => {
      const repo = createInMemoryCommentRepository();
      await expect(
        repo.listByWorker({ workerId: "worker-1", cursor: "nonexistent-cursor" }),
      ).rejects.toThrow("Cursor not found");
    });
  });
});
