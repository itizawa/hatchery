import { describe, expect, it } from "vitest";
import { createInMemoryPostRepository } from "./postRepository.js";

describe("createInMemoryPostRepository", () => {
  describe("createMany", () => {
    it("複数の post をバルク作成できる", async () => {
      const repo = createInMemoryPostRepository();
      const created = await repo.createMany("community-1", [
        { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Title 1", text: "Text 1" },
        { slotKey: "2026-06-10T09:00", seq: 1, author: "worker-2", title: "Title 2", text: "Text 2" },
      ]);
      expect(created).toHaveLength(2);
      expect(created[0].communityId).toBe("community-1");
      expect(created[0].score).toBe(0);
      expect(created[1].seq).toBe(1);
    });

    it("(communityId, slotKey, seq) が重複する場合は既存を返す（Cron 二重発火ガード）", async () => {
      const repo = createInMemoryPostRepository();
      await repo.createMany("community-1", [
        { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Title 1", text: "Text 1" },
      ]);
      const second = await repo.createMany("community-1", [
        { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Title 1", text: "Text 1" },
      ]);
      expect(second).toHaveLength(1);
      const all = await repo.listByCommunity("community-1");
      expect(all).toHaveLength(1); // 重複しないこと
    });
  });

  describe("listByCommunity", () => {
    it("community の post を新着順で返す", async () => {
      const repo = createInMemoryPostRepository();
      await repo.createMany("community-1", [
        { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Old", text: "Old" },
      ]);
      await new Promise((r) => setTimeout(r, 5)); // 時間差を作る
      await repo.createMany("community-1", [
        { slotKey: "2026-06-10T18:00", seq: 0, author: "worker-2", title: "New", text: "New" },
      ]);
      const result = await repo.listByCommunity("community-1");
      expect(result[0].title).toBe("New"); // 新着順
    });

    it("別の community の post は含めない", async () => {
      const repo = createInMemoryPostRepository();
      await repo.createMany("community-1", [
        { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "C1 Post", text: "text" },
      ]);
      await repo.createMany("community-2", [
        { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "C2 Post", text: "text" },
      ]);
      const result = await repo.listByCommunity("community-1");
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("C1 Post");
    });
  });

  describe("findById", () => {
    it("存在する id で取得できる", async () => {
      const repo = createInMemoryPostRepository();
      const [created] = await repo.createMany("community-1", [
        { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Title", text: "Text" },
      ]);
      const result = await repo.findById(created.id);
      expect(result).toMatchObject({ title: "Title" });
    });

    it("存在しない id は null を返す", async () => {
      const repo = createInMemoryPostRepository();
      const result = await repo.findById("not-exists");
      expect(result).toBeNull();
    });
  });

  describe("addScore", () => {
    it("score を加算できる", async () => {
      const repo = createInMemoryPostRepository();
      const [created] = await repo.createMany("community-1", [
        { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Title", text: "Text" },
      ]);
      const updated = await repo.addScore(created.id, 1);
      expect(updated?.score).toBe(1);
    });

    it("存在しない id は null を返す", async () => {
      const repo = createInMemoryPostRepository();
      const result = await repo.addScore("not-exists", 1);
      expect(result).toBeNull();
    });
  });

  describe("listLatest", () => {
    it("全 community の post を新着順で返す", async () => {
      const repo = createInMemoryPostRepository();
      await repo.createMany("community-1", [
        { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "C1 Post", text: "text" },
      ]);
      await new Promise((r) => setTimeout(r, 5));
      await repo.createMany("community-2", [
        { slotKey: "2026-06-10T18:00", seq: 0, author: "worker-2", title: "C2 Post", text: "text" },
      ]);
      const result = await repo.listLatest();
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe("C2 Post"); // 新着順
    });

    it("limit を指定すると上限件数で返す", async () => {
      const repo = createInMemoryPostRepository();
      await repo.createMany("community-1", [
        { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Post 1", text: "text" },
        { slotKey: "2026-06-10T09:00", seq: 1, author: "worker-2", title: "Post 2", text: "text" },
        { slotKey: "2026-06-10T09:00", seq: 2, author: "worker-3", title: "Post 3", text: "text" },
      ]);
      const result = await repo.listLatest(2);
      expect(result).toHaveLength(2);
    });

    it("post が 0 件のときは空配列を返す", async () => {
      const repo = createInMemoryPostRepository();
      const result = await repo.listLatest();
      expect(result).toEqual([]);
    });
  });

  describe("listPopularPaged", () => {
    it("score 降順で返す（同点は createdAt 降順）", async () => {
      const repo = createInMemoryPostRepository();
      const [a] = await repo.createMany("community-1", [
        { slotKey: "s", seq: 0, author: "w", title: "A", text: "t" },
      ]);
      await new Promise((r) => setTimeout(r, 5));
      const [b] = await repo.createMany("community-1", [
        { slotKey: "s", seq: 1, author: "w", title: "B", text: "t" },
      ]);
      await new Promise((r) => setTimeout(r, 5));
      const [c] = await repo.createMany("community-1", [
        { slotKey: "s", seq: 2, author: "w", title: "C", text: "t" },
      ]);
      await repo.addScore(a.id, 5);
      await repo.addScore(b.id, 10);
      await repo.addScore(c.id, 10);

      const { posts } = await repo.listPopularPaged(undefined, 20);
      // score 降順: B(10),C(10) が先。同点は createdAt 降順なので C(後発) > B
      expect(posts.map((p) => p.title)).toEqual(["C", "B", "A"]);
    });

    it("カーソルで次ページを取得でき、重複・欠落がない", async () => {
      const repo = createInMemoryPostRepository();
      for (let i = 0; i < 5; i++) {
        const [p] = await repo.createMany("community-1", [
          { slotKey: "s", seq: i, author: "w", title: `P${i}`, text: "t" },
        ]);
        await repo.addScore(p.id, i); // score: 0,1,2,3,4
      }
      const page1 = await repo.listPopularPaged(undefined, 2);
      expect(page1.posts).toHaveLength(2);
      expect(page1.nextCursor).not.toBeNull();
      const page2 = await repo.listPopularPaged(page1.nextCursor!, 2);
      expect(page2.posts).toHaveLength(2);
      const page3 = await repo.listPopularPaged(page2.nextCursor!, 2);
      expect(page3.posts).toHaveLength(1);
      expect(page3.nextCursor).toBeNull();

      const ids = [...page1.posts, ...page2.posts, ...page3.posts].map((p) => p.id);
      expect(ids.length).toBe(5);
      expect(new Set(ids).size).toBe(5);
      // 全体が score 降順
      const scores = [...page1.posts, ...page2.posts, ...page3.posts].map((p) => p.score);
      expect(scores).toEqual([4, 3, 2, 1, 0]);
    });

    it("post が 0 件のときは空配列・nextCursor=null", async () => {
      const repo = createInMemoryPostRepository();
      const result = await repo.listPopularPaged(undefined, 20);
      expect(result).toEqual({ posts: [], nextCursor: null });
    });

    it("不正な cursor は INVALID_CURSOR で reject", async () => {
      const repo = createInMemoryPostRepository();
      const invalid = Buffer.from("not-json").toString("base64");
      await expect(repo.listPopularPaged(invalid, 20)).rejects.toThrow("INVALID_CURSOR");
    });
  });
});
