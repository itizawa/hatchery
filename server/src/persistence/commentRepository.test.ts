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

  describe("isSummary（まとめコメント・#1165）", () => {
    it("isSummary を省略すると false になる", async () => {
      const repo = createInMemoryCommentRepository();
      const [created] = await repo.createMany("community-1", [
        { postId: "post-1", slotKey: "s", seq: 0, author: "worker-1", text: "通常コメント" },
      ]);
      expect(created.isSummary).toBe(false);
    });

    it("isSummary: true を指定して作成でき、そのまま読み出せる", async () => {
      const repo = createInMemoryCommentRepository();
      await repo.createMany("community-1", [
        { postId: "post-1", slotKey: "s", seq: 0, author: "worker-1", text: "まとめコメント", isSummary: true },
      ]);
      const result = await repo.listByPost("post-1");
      expect(result[0].isSummary).toBe(true);
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

    it("now を渡すと createdAt > now のコメントは件数に含まれない（#875）", async () => {
      const repo = createInMemoryCommentRepository();
      const past = new Date(Date.now() - 10_000);
      const future = new Date(Date.now() + 60_000);
      await repo.createMany("community-1", [
        { postId: "post-1", slotKey: "s", seq: 0, author: "w", text: "past", createdAt: past },
        { postId: "post-1", slotKey: "s", seq: 1, author: "w", text: "future", createdAt: future },
      ]);
      const now = new Date();
      const counts = await repo.countByPostIds(["post-1"], { now });
      expect(counts.get("post-1")).toBe(1);
    });

    it("now を渡さないと全件集計（後方互換・#875）", async () => {
      const repo = createInMemoryCommentRepository();
      const future = new Date(Date.now() + 60_000);
      await repo.createMany("community-1", [
        { postId: "post-1", slotKey: "s", seq: 0, author: "w", text: "c1" },
        { postId: "post-1", slotKey: "s", seq: 1, author: "w", text: "future", createdAt: future },
      ]);
      const counts = await repo.countByPostIds(["post-1"]);
      expect(counts.get("post-1")).toBe(2);
    });

    it("過去・未来混在の複数 post に対して now フィルタが正確に適用される（#875）", async () => {
      const repo = createInMemoryCommentRepository();
      const past = new Date(Date.now() - 10_000);
      const future = new Date(Date.now() + 60_000);
      await repo.createMany("community-1", [
        { postId: "post-1", slotKey: "s", seq: 0, author: "w", text: "p1-past", createdAt: past },
        { postId: "post-1", slotKey: "s", seq: 1, author: "w", text: "p1-future", createdAt: future },
        { postId: "post-2", slotKey: "s", seq: 2, author: "w", text: "p2-future", createdAt: future },
      ]);
      const now = new Date();
      const counts = await repo.countByPostIds(["post-1", "post-2"], { now });
      expect(counts.get("post-1")).toBe(1);
      expect(counts.has("post-2")).toBe(false);
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

  describe("reveal フィルタ（#556）", () => {
    it("createMany に createdAt を渡すと指定した時刻で永続化される", async () => {
      const repo = createInMemoryCommentRepository();
      const future = new Date(Date.now() + 60_000);
      const [created] = await repo.createMany("community-1", [
        { postId: "post-1", slotKey: "s", seq: 0, author: "w", text: "c", createdAt: future },
      ]);
      expect(created.createdAt.getTime()).toBe(future.getTime());
    });

    it("listByPost に now を渡すと createdAt > now のコメントは除外される", async () => {
      const repo = createInMemoryCommentRepository();
      const past = new Date(Date.now() - 10_000);
      const future = new Date(Date.now() + 60_000);
      await repo.createMany("community-1", [
        { postId: "post-1", slotKey: "s", seq: 0, author: "w", text: "past", createdAt: past },
        { postId: "post-1", slotKey: "s", seq: 1, author: "w", text: "future", createdAt: future },
      ]);
      const now = new Date();
      const result = await repo.listByPost("post-1", { now });
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("past");
    });

    it("listByPost に now を渡さないと全件返す（後方互換）", async () => {
      const repo = createInMemoryCommentRepository();
      const future = new Date(Date.now() + 60_000);
      await repo.createMany("community-1", [
        { postId: "post-1", slotKey: "s", seq: 0, author: "w", text: "past" },
        { postId: "post-1", slotKey: "s", seq: 1, author: "w", text: "future", createdAt: future },
      ]);
      const result = await repo.listByPost("post-1");
      expect(result).toHaveLength(2);
    });

    it("listByCommunity に now を渡すと createdAt > now のコメントは除外される", async () => {
      const repo = createInMemoryCommentRepository();
      const past = new Date(Date.now() - 10_000);
      const future = new Date(Date.now() + 60_000);
      await repo.createMany("community-1", [
        { postId: "post-1", slotKey: "s", seq: 0, author: "w", text: "past", createdAt: past },
        { postId: "post-1", slotKey: "s", seq: 1, author: "w", text: "future", createdAt: future },
      ]);
      const now = new Date();
      const result = await repo.listByCommunity("community-1", 50, { now });
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("past");
    });

    it("listByCommunity に now を渡さないと全件返す（後方互換）", async () => {
      const repo = createInMemoryCommentRepository();
      const future = new Date(Date.now() + 60_000);
      await repo.createMany("community-1", [
        { postId: "post-1", slotKey: "s", seq: 0, author: "w", text: "past" },
        { postId: "post-1", slotKey: "s", seq: 1, author: "w", text: "future", createdAt: future },
      ]);
      const result = await repo.listByCommunity("community-1");
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
  });

  describe("count（#1113）", () => {
    it("comment が 0 件のとき 0 を返す", async () => {
      const repo = createInMemoryCommentRepository();
      expect(await repo.count()).toBe(0);
    });

    it("複数コミュニティの comment をまとめて総数で返す", async () => {
      const repo = createInMemoryCommentRepository();
      await repo.createMany("community-1", [
        { postId: "p1", slotKey: "s", seq: 0, author: "worker-1", text: "a" },
        { postId: "p1", slotKey: "s", seq: 1, author: "worker-1", text: "b" },
      ]);
      await repo.createMany("community-2", [
        { postId: "p2", slotKey: "s", seq: 0, author: "worker-1", text: "c" },
      ]);
      expect(await repo.count()).toBe(3);
    });
  });
});
