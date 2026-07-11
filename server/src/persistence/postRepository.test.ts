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

  describe("listLatestPaged", () => {
    it("カーソルで次ページを取得でき、重複・欠落がない（新着順）", async () => {
      const repo = createInMemoryPostRepository();
      for (let i = 0; i < 5; i++) {
        await repo.createMany("community-1", [
          { slotKey: "s", seq: i, author: "w", title: `P${i}`, text: "t" },
        ]);
        await new Promise((r) => setTimeout(r, 2)); // createdAt に差を付ける
      }
      const page1 = await repo.listLatestPaged(undefined, 2);
      expect(page1.posts).toHaveLength(2);
      expect(page1.nextCursor).not.toBeNull();
      const page2 = await repo.listLatestPaged(page1.nextCursor!, 2);
      expect(page2.posts).toHaveLength(2);
      const page3 = await repo.listLatestPaged(page2.nextCursor!, 2);
      expect(page3.posts).toHaveLength(1);
      expect(page3.nextCursor).toBeNull();

      const ids = [...page1.posts, ...page2.posts, ...page3.posts].map((p) => p.id);
      expect(ids.length).toBe(5);
      expect(new Set(ids).size).toBe(5);
      // 全体が新着順（後発が先頭）
      const titles = [...page1.posts, ...page2.posts, ...page3.posts].map((p) => p.title);
      expect(titles).toEqual(["P4", "P3", "P2", "P1", "P0"]);
    });

    it("post が 0 件のときは空配列・nextCursor=null", async () => {
      const repo = createInMemoryPostRepository();
      const result = await repo.listLatestPaged(undefined, 20);
      expect(result).toEqual({ posts: [], nextCursor: null });
    });

    it("不正な cursor は INVALID_CURSOR で reject", async () => {
      const repo = createInMemoryPostRepository();
      const invalid = Buffer.from("not-json").toString("base64");
      await expect(repo.listLatestPaged(invalid, 20)).rejects.toThrow("INVALID_CURSOR");
    });
  });

  describe("listTopByCommunity (#558)", () => {
    it("score >= minScore かつ createdAt >= since の post を score 降順で返す", async () => {
      const repo = createInMemoryPostRepository();
      const now = new Date("2026-06-15T00:00:00Z");
      const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7日前

      // 期間内・スコア高い
      const [p1] = await repo.createMany("community-1", [
        { slotKey: "s", seq: 0, author: "w1", title: "Top Post", text: "t" },
      ]);
      await repo.addScore(p1.id, 5);

      // 期間内・スコア低い（minScore 未満）
      const [p2] = await repo.createMany("community-1", [
        { slotKey: "s", seq: 1, author: "w2", title: "Low Score Post", text: "t" },
      ]);
      await repo.addScore(p2.id, 0); // score = 0, minScore=1 では対象外

      // 期間内・スコア中
      const [p3] = await repo.createMany("community-1", [
        { slotKey: "s", seq: 2, author: "w3", title: "Mid Score Post", text: "t" },
      ]);
      await repo.addScore(p3.id, 3);

      const result = await repo.listTopByCommunity("community-1", {
        since,
        minScore: 1,
        limit: 10,
      });

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe("Top Post"); // score 5
      expect(result[1].title).toBe("Mid Score Post"); // score 3
    });

    it("since より古い post は除外する", async () => {
      const repo = createInMemoryPostRepository();
      const [p1] = await repo.createMany("community-1", [
        { slotKey: "s", seq: 0, author: "w1", title: "Old Post", text: "t" },
      ]);
      await repo.addScore(p1.id, 10);

      // createdAt を古い日付に偽装するためにテスト用固有手段が必要。
      // in-memory では createMany が new Date() を使うので、since を過去の時点で制御する。
      // 直近の post のみを対象にするため since を「今の瞬間」に設定
      const strictSince = new Date(Date.now() + 1000); // 未来

      const result = await repo.listTopByCommunity("community-1", {
        since: strictSince,
        minScore: 1,
        limit: 10,
      });

      expect(result).toHaveLength(0);
    });

    it("limit 件数で打ち切る", async () => {
      const repo = createInMemoryPostRepository();
      for (let i = 0; i < 5; i++) {
        const [p] = await repo.createMany("community-1", [
          { slotKey: "s", seq: i, author: "w", title: `Post ${i}`, text: "t" },
        ]);
        await repo.addScore(p.id, i + 1); // score: 1..5
      }
      const since = new Date(0); // 全件対象

      const result = await repo.listTopByCommunity("community-1", {
        since,
        minScore: 1,
        limit: 3,
      });

      expect(result).toHaveLength(3);
      // score 降順: Post 4 (score5) > Post 3 (score4) > Post 2 (score3)
      expect(result[0].score).toBe(5);
      expect(result[1].score).toBe(4);
      expect(result[2].score).toBe(3);
    });

    it("対象が 0 件のときは空配列を返す", async () => {
      const repo = createInMemoryPostRepository();
      const since = new Date(0);

      const result = await repo.listTopByCommunity("community-1", {
        since,
        minScore: 1,
        limit: 10,
      });

      expect(result).toHaveLength(0);
    });

    it("別 community の post は除外する", async () => {
      const repo = createInMemoryPostRepository();
      const [p1] = await repo.createMany("community-2", [
        { slotKey: "s", seq: 0, author: "w1", title: "Other Community Post", text: "t" },
      ]);
      await repo.addScore(p1.id, 10);
      const since = new Date(0);

      const result = await repo.listTopByCommunity("community-1", {
        since,
        minScore: 1,
        limit: 10,
      });

      expect(result).toHaveLength(0);
    });
  });

  describe("listByCommunityPaged (#881)", () => {
    it("カーソルで次ページを取得でき、重複・欠落がない（新着順）", async () => {
      const repo = createInMemoryPostRepository();
      for (let i = 0; i < 5; i++) {
        await repo.createMany("community-1", [
          { slotKey: "s", seq: i, author: "w", title: `P${i}`, text: "t" },
        ]);
        await new Promise((r) => setTimeout(r, 2));
      }
      const page1 = await repo.listByCommunityPaged({ communityId: "community-1", limit: 2 });
      expect(page1.posts).toHaveLength(2);
      expect(page1.nextCursor).not.toBeNull();
      const page2 = await repo.listByCommunityPaged({ communityId: "community-1", cursor: page1.nextCursor!, limit: 2 });
      expect(page2.posts).toHaveLength(2);
      const page3 = await repo.listByCommunityPaged({ communityId: "community-1", cursor: page2.nextCursor!, limit: 2 });
      expect(page3.posts).toHaveLength(1);
      expect(page3.nextCursor).toBeNull();

      const ids = [...page1.posts, ...page2.posts, ...page3.posts].map((p) => p.id);
      expect(ids.length).toBe(5);
      expect(new Set(ids).size).toBe(5);
      const titles = [...page1.posts, ...page2.posts, ...page3.posts].map((p) => p.title);
      expect(titles).toEqual(["P4", "P3", "P2", "P1", "P0"]);
    });

    it("別 community の post は含めない", async () => {
      const repo = createInMemoryPostRepository();
      await repo.createMany("community-1", [
        { slotKey: "s", seq: 0, author: "w", title: "C1", text: "t" },
      ]);
      await repo.createMany("community-2", [
        { slotKey: "s", seq: 0, author: "w", title: "C2", text: "t" },
      ]);
      const { posts } = await repo.listByCommunityPaged({ communityId: "community-1", limit: 20 });
      expect(posts).toHaveLength(1);
      expect(posts[0].title).toBe("C1");
    });

    it("post が 0 件のときは空配列・nextCursor=null", async () => {
      const repo = createInMemoryPostRepository();
      const result = await repo.listByCommunityPaged({ communityId: "community-1", limit: 20 });
      expect(result).toEqual({ posts: [], nextCursor: null });
    });

    it("不正な cursor は INVALID_CURSOR で reject", async () => {
      const repo = createInMemoryPostRepository();
      const invalid = Buffer.from("not-json").toString("base64");
      await expect(repo.listByCommunityPaged({ communityId: "community-1", cursor: invalid, limit: 20 })).rejects.toThrow("INVALID_CURSOR");
    });

    it("now を渡すと createdAt > now の post は除外される", async () => {
      const repo = createInMemoryPostRepository();
      const past = new Date(Date.now() - 10_000);
      const future = new Date(Date.now() + 60_000);
      await repo.createMany("community-1", [
        { slotKey: "s", seq: 0, author: "w", title: "past", text: "t", createdAt: past },
        { slotKey: "s", seq: 1, author: "w", title: "future", text: "t", createdAt: future },
      ]);
      const now = new Date();
      const { posts, nextCursor } = await repo.listByCommunityPaged({ communityId: "community-1", limit: 20, options: { now } });
      expect(posts).toHaveLength(1);
      expect(posts[0].title).toBe("past");
      expect(nextCursor).toBeNull();
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

  describe("reveal フィルタ（#556）", () => {
    it("createMany に createdAt を渡すと指定した時刻で永続化される", async () => {
      const repo = createInMemoryPostRepository();
      const future = new Date(Date.now() + 60_000);
      const [created] = await repo.createMany("community-1", [
        { slotKey: "s", seq: 0, author: "w", title: "T", text: "t", createdAt: future },
      ]);
      expect(created.createdAt.getTime()).toBe(future.getTime());
    });

    it("listByCommunity に now を渡すと createdAt > now の post は除外される", async () => {
      const repo = createInMemoryPostRepository();
      const past = new Date(Date.now() - 10_000);
      const future = new Date(Date.now() + 60_000);
      await repo.createMany("community-1", [
        { slotKey: "s", seq: 0, author: "w", title: "past", text: "t", createdAt: past },
        { slotKey: "s", seq: 1, author: "w", title: "future", text: "t", createdAt: future },
      ]);
      const now = new Date();
      const result = await repo.listByCommunity("community-1", 50, { now });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("past");
    });

    it("listByCommunity に now を渡さないと全件返す（後方互換）", async () => {
      const repo = createInMemoryPostRepository();
      const future = new Date(Date.now() + 60_000);
      await repo.createMany("community-1", [
        { slotKey: "s", seq: 0, author: "w", title: "past", text: "t" },
        { slotKey: "s", seq: 1, author: "w", title: "future", text: "t", createdAt: future },
      ]);
      const result = await repo.listByCommunity("community-1");
      expect(result).toHaveLength(2);
    });

    it("listLatest に now を渡すと createdAt > now の post は除外される", async () => {
      const repo = createInMemoryPostRepository();
      const past = new Date(Date.now() - 10_000);
      const future = new Date(Date.now() + 60_000);
      await repo.createMany("community-1", [
        { slotKey: "s", seq: 0, author: "w", title: "past", text: "t", createdAt: past },
        { slotKey: "s", seq: 1, author: "w", title: "future", text: "t", createdAt: future },
      ]);
      const now = new Date();
      const result = await repo.listLatest(50, { now });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("past");
    });

    it("listLatest に now を渡さないと全件返す（後方互換）", async () => {
      const repo = createInMemoryPostRepository();
      const future = new Date(Date.now() + 60_000);
      await repo.createMany("community-1", [
        { slotKey: "s", seq: 0, author: "w", title: "past", text: "t" },
        { slotKey: "s", seq: 1, author: "w", title: "future", text: "t", createdAt: future },
      ]);
      const result = await repo.listLatest();
      expect(result).toHaveLength(2);
    });

    it("listLatestPaged に now を渡すと createdAt > now の post は除外される", async () => {
      const repo = createInMemoryPostRepository();
      const past = new Date(Date.now() - 10_000);
      const future = new Date(Date.now() + 60_000);
      await repo.createMany("community-1", [
        { slotKey: "s", seq: 0, author: "w", title: "past", text: "t", createdAt: past },
        { slotKey: "s", seq: 1, author: "w", title: "future", text: "t", createdAt: future },
      ]);
      const now = new Date();
      const { posts, nextCursor } = await repo.listLatestPaged(undefined, 20, { now });
      expect(posts).toHaveLength(1);
      expect(posts[0].title).toBe("past");
      expect(nextCursor).toBeNull();
    });

    it("listLatestPaged に now を渡さないと全件返す（後方互換）", async () => {
      const repo = createInMemoryPostRepository();
      const future = new Date(Date.now() + 60_000);
      await repo.createMany("community-1", [
        { slotKey: "s", seq: 0, author: "w", title: "past", text: "t" },
        { slotKey: "s", seq: 1, author: "w", title: "future", text: "t", createdAt: future },
      ]);
      const { posts } = await repo.listLatestPaged(undefined, 20);
      expect(posts).toHaveLength(2);
    });

    it("listPopularPaged に now を渡すと createdAt > now の post は除外される", async () => {
      const repo = createInMemoryPostRepository();
      const past = new Date(Date.now() - 10_000);
      const future = new Date(Date.now() + 60_000);
      await repo.createMany("community-1", [
        { slotKey: "s", seq: 0, author: "w", title: "past", text: "t", createdAt: past },
        { slotKey: "s", seq: 1, author: "w", title: "future", text: "t", createdAt: future },
      ]);
      const now = new Date();
      const { posts } = await repo.listPopularPaged(undefined, 20, { now });
      expect(posts).toHaveLength(1);
      expect(posts[0].title).toBe("past");
    });

    it("listPopularPaged に now を渡さないと全件返す（後方互換）", async () => {
      const repo = createInMemoryPostRepository();
      const future = new Date(Date.now() + 60_000);
      await repo.createMany("community-1", [
        { slotKey: "s", seq: 0, author: "w", title: "past", text: "t" },
        { slotKey: "s", seq: 1, author: "w", title: "future", text: "t", createdAt: future },
      ]);
      const { posts } = await repo.listPopularPaged(undefined, 20);
      expect(posts).toHaveLength(2);
    });
  });

  describe("tags（#1087）", () => {
    it("createMany で tags を永続化できる", async () => {
      const repo = createInMemoryPostRepository();
      const [created] = await repo.createMany("community-1", [
        { slotKey: "s", seq: 0, author: "w", title: "t", text: "text", tags: ["react", "vite"] },
      ]);
      expect(created.tags).toEqual(["react", "vite"]);
    });

    it("tags を省略すると空配列になる", async () => {
      const repo = createInMemoryPostRepository();
      const [created] = await repo.createMany("community-1", [
        { slotKey: "s", seq: 0, author: "w", title: "t", text: "text" },
      ]);
      expect(created.tags).toEqual([]);
    });

    it("findById で取得した post も tags を持つ", async () => {
      const repo = createInMemoryPostRepository();
      const [created] = await repo.createMany("community-1", [
        { slotKey: "s", seq: 0, author: "w", title: "t", text: "text", tags: ["react"] },
      ]);
      const found = await repo.findById(created.id);
      expect(found?.tags).toEqual(["react"]);
    });
  });

  describe("listRelatedByTags（#1087）", () => {
    it("同一 community 内でタグを 1 つ以上共有する post を新着順で返す", async () => {
      const repo = createInMemoryPostRepository();
      const [target] = await repo.createMany("community-1", [
        { slotKey: "s", seq: 0, author: "w", title: "target", text: "text", tags: ["react", "vite"] },
      ]);
      await new Promise((r) => setTimeout(r, 5));
      const [older] = await repo.createMany("community-1", [
        { slotKey: "s", seq: 1, author: "w", title: "older-match", text: "text", tags: ["react"] },
      ]);
      await new Promise((r) => setTimeout(r, 5));
      const [newer] = await repo.createMany("community-1", [
        { slotKey: "s", seq: 2, author: "w", title: "newer-match", text: "text", tags: ["vite", "typescript"] },
      ]);
      await repo.createMany("community-1", [
        { slotKey: "s", seq: 3, author: "w", title: "no-match", text: "text", tags: ["golang"] },
      ]);

      const result = await repo.listRelatedByTags({
        communityId: "community-1",
        tags: target.tags,
        excludePostId: target.id,
        limit: 5,
      });

      expect(result.map((p) => p.id)).toEqual([newer.id, older.id]);
    });

    it("自分自身（excludePostId）は結果に含めない", async () => {
      const repo = createInMemoryPostRepository();
      const [target] = await repo.createMany("community-1", [
        { slotKey: "s", seq: 0, author: "w", title: "target", text: "text", tags: ["react"] },
      ]);

      const result = await repo.listRelatedByTags({
        communityId: "community-1",
        tags: target.tags,
        excludePostId: target.id,
        limit: 5,
      });

      expect(result).toEqual([]);
    });

    it("別 community の post は含めない", async () => {
      const repo = createInMemoryPostRepository();
      await repo.createMany("community-2", [
        { slotKey: "s", seq: 0, author: "w", title: "other-community", text: "text", tags: ["react"] },
      ]);

      const result = await repo.listRelatedByTags({
        communityId: "community-1",
        tags: ["react"],
        excludePostId: "nonexistent",
        limit: 5,
      });

      expect(result).toEqual([]);
    });

    it("tags が空配列のときは空配列を返す", async () => {
      const repo = createInMemoryPostRepository();
      await repo.createMany("community-1", [
        { slotKey: "s", seq: 0, author: "w", title: "post", text: "text", tags: ["react"] },
      ]);

      const result = await repo.listRelatedByTags({
        communityId: "community-1",
        tags: [],
        excludePostId: "nonexistent",
        limit: 5,
      });

      expect(result).toEqual([]);
    });

    it("limit で件数を絞る", async () => {
      const repo = createInMemoryPostRepository();
      for (let i = 0; i < 3; i++) {
        await repo.createMany("community-1", [
          { slotKey: "s", seq: i, author: "w", title: `match-${i}`, text: "text", tags: ["react"] },
        ]);
      }

      const result = await repo.listRelatedByTags({
        communityId: "community-1",
        tags: ["react"],
        excludePostId: "nonexistent",
        limit: 2,
      });

      expect(result).toHaveLength(2);
    });

    it("options.now を渡すと createdAt > now（ドリップ配信で未公開）の post を除外する", async () => {
      const repo = createInMemoryPostRepository();
      const now = new Date("2026-07-09T12:00:00Z");
      await repo.createMany("community-1", [
        {
          slotKey: "s",
          seq: 0,
          author: "w",
          title: "revealed",
          text: "text",
          tags: ["react"],
          createdAt: new Date("2026-07-09T11:00:00Z"),
        },
        {
          slotKey: "s",
          seq: 1,
          author: "w",
          title: "not-yet-revealed",
          text: "text",
          tags: ["react"],
          createdAt: new Date("2026-07-09T13:00:00Z"),
        },
      ]);

      const result = await repo.listRelatedByTags({
        communityId: "community-1",
        tags: ["react"],
        excludePostId: "nonexistent",
        limit: 5,
        options: { now },
      });

      expect(result.map((p) => p.title)).toEqual(["revealed"]);
    });

    it("options を渡さないときは createdAt によるフィルタを行わない（後方互換）", async () => {
      const repo = createInMemoryPostRepository();
      await repo.createMany("community-1", [
        {
          slotKey: "s",
          seq: 0,
          author: "w",
          title: "future",
          text: "text",
          tags: ["react"],
          createdAt: new Date("2999-01-01T00:00:00Z"),
        },
      ]);

      const result = await repo.listRelatedByTags({
        communityId: "community-1",
        tags: ["react"],
        excludePostId: "nonexistent",
        limit: 5,
      });

      expect(result).toHaveLength(1);
    });
  });

  describe("updateTitleAndText (#1117)", () => {
    it("指定 id の title/text を更新する", async () => {
      const repo = createInMemoryPostRepository();
      const [created] = await repo.createMany("community-1", [
        { slotKey: "s", seq: 0, author: "w", title: "旧タイトル", text: "旧本文" },
      ]);

      const updated = await repo.updateTitleAndText({
        id: created.id,
        title: "新タイトル",
        text: "新本文",
      });

      expect(updated?.title).toBe("新タイトル");
      expect(updated?.text).toBe("新本文");
      const found = await repo.findById(created.id);
      expect(found?.title).toBe("新タイトル");
      expect(found?.text).toBe("新本文");
    });

    it("存在しない id の場合は null を返す", async () => {
      const repo = createInMemoryPostRepository();
      const updated = await repo.updateTitleAndText({
        id: "nonexistent",
        title: "新タイトル",
        text: "新本文",
      });
      expect(updated).toBeNull();
    });
  });

  describe("pin / unpin (#1089)", () => {
    it("createMany で作成した post は isPinned: false / pinnedAt: null で初期化される", async () => {
      const repo = createInMemoryPostRepository();
      const [created] = await repo.createMany("community-1", [
        { slotKey: "s", seq: 0, author: "w", title: "post", text: "text" },
      ]);
      expect(created.isPinned).toBe(false);
      expect(created.pinnedAt).toBeNull();
    });

    it("pinPost で post を pin できる", async () => {
      const repo = createInMemoryPostRepository();
      const [created] = await repo.createMany("community-1", [
        { slotKey: "s", seq: 0, author: "w", title: "post", text: "text" },
      ]);
      const pinnedAt = new Date("2026-07-11T00:00:00Z");
      const updated = await repo.pinPost({ id: created.id, pinnedAt });
      expect(updated?.isPinned).toBe(true);
      expect(updated?.pinnedAt).toEqual(pinnedAt);
      const found = await repo.findById(created.id);
      expect(found?.isPinned).toBe(true);
    });

    it("pinPost で存在しない id の場合は null を返す", async () => {
      const repo = createInMemoryPostRepository();
      const result = await repo.pinPost({ id: "nonexistent", pinnedAt: new Date() });
      expect(result).toBeNull();
    });

    it("unpinPost で pin を解除できる", async () => {
      const repo = createInMemoryPostRepository();
      const [created] = await repo.createMany("community-1", [
        { slotKey: "s", seq: 0, author: "w", title: "post", text: "text" },
      ]);
      await repo.pinPost({ id: created.id, pinnedAt: new Date() });
      const updated = await repo.unpinPost(created.id);
      expect(updated?.isPinned).toBe(false);
      expect(updated?.pinnedAt).toBeNull();
    });

    it("unpinPost で存在しない id の場合は null を返す", async () => {
      const repo = createInMemoryPostRepository();
      const result = await repo.unpinPost("nonexistent");
      expect(result).toBeNull();
    });

    it("countPinnedByCommunity は community 内の pin 済み件数を返す", async () => {
      const repo = createInMemoryPostRepository();
      const posts = await repo.createMany("community-1", [
        { slotKey: "s", seq: 0, author: "w", title: "p1", text: "t" },
        { slotKey: "s", seq: 1, author: "w", title: "p2", text: "t" },
        { slotKey: "s", seq: 2, author: "w", title: "p3", text: "t" },
      ]);
      await repo.pinPost({ id: posts[0]!.id, pinnedAt: new Date() });
      await repo.pinPost({ id: posts[1]!.id, pinnedAt: new Date() });
      const count = await repo.countPinnedByCommunity("community-1");
      expect(count).toBe(2);
    });

    it("countPinnedByCommunity は別の community の pin を数えない", async () => {
      const repo = createInMemoryPostRepository();
      const [post] = await repo.createMany("community-2", [
        { slotKey: "s", seq: 0, author: "w", title: "p1", text: "t" },
      ]);
      await repo.pinPost({ id: post!.id, pinnedAt: new Date() });
      const count = await repo.countPinnedByCommunity("community-1");
      expect(count).toBe(0);
    });

    it("listPinnedByCommunity は pin 済み post を pinnedAt 降順で返す", async () => {
      const repo = createInMemoryPostRepository();
      const posts = await repo.createMany("community-1", [
        { slotKey: "s", seq: 0, author: "w", title: "older-pin", text: "t" },
        { slotKey: "s", seq: 1, author: "w", title: "newer-pin", text: "t" },
        { slotKey: "s", seq: 2, author: "w", title: "not-pinned", text: "t" },
      ]);
      await repo.pinPost({ id: posts[0]!.id, pinnedAt: new Date("2026-07-01T00:00:00Z") });
      await repo.pinPost({ id: posts[1]!.id, pinnedAt: new Date("2026-07-05T00:00:00Z") });
      const result = await repo.listPinnedByCommunity("community-1");
      expect(result.map((p) => p.title)).toEqual(["newer-pin", "older-pin"]);
    });

    it("listPinnedByCommunity は pin が 0 件のとき空配列を返す", async () => {
      const repo = createInMemoryPostRepository();
      await repo.createMany("community-1", [
        { slotKey: "s", seq: 0, author: "w", title: "post", text: "text" },
      ]);
      const result = await repo.listPinnedByCommunity("community-1");
      expect(result).toEqual([]);
    });

    it("同一 pinnedAt の場合は id 降順を tie-break にする（バックエンド間の順序整合）", async () => {
      const repo = createInMemoryPostRepository();
      const posts = await repo.createMany("community-1", [
        { slotKey: "s", seq: 0, author: "w", title: "a", text: "t" },
        { slotKey: "s", seq: 1, author: "w", title: "b", text: "t" },
      ]);
      const samePinnedAt = new Date("2026-07-01T00:00:00Z");
      await repo.pinPost({ id: posts[0]!.id, pinnedAt: samePinnedAt });
      await repo.pinPost({ id: posts[1]!.id, pinnedAt: samePinnedAt });
      const result = await repo.listPinnedByCommunity("community-1");
      // eslint-disable-next-line max-params
      const sortedByIdDesc = [...posts].sort((x, y) => (x.id < y.id ? 1 : x.id > y.id ? -1 : 0));
      expect(result.map((p) => p.id)).toEqual(sortedByIdDesc.map((p) => p.id));
    });

    it("options.now を渡すと createdAt > now（ドリップ配信で未公開）の pin 済み post を除外する（ADR-0034）", async () => {
      const repo = createInMemoryPostRepository();
      const now = new Date("2026-07-11T12:00:00Z");
      const posts = await repo.createMany("community-1", [
        {
          slotKey: "s",
          seq: 0,
          author: "w",
          title: "revealed",
          text: "t",
          createdAt: new Date("2026-07-11T11:00:00Z"),
        },
        {
          slotKey: "s",
          seq: 1,
          author: "w",
          title: "not-yet-revealed",
          text: "t",
          createdAt: new Date("2026-07-11T13:00:00Z"),
        },
      ]);
      await repo.pinPost({ id: posts[0]!.id, pinnedAt: new Date("2026-07-10T00:00:00Z") });
      await repo.pinPost({ id: posts[1]!.id, pinnedAt: new Date("2026-07-10T00:00:00Z") });
      const result = await repo.listPinnedByCommunity("community-1", { now });
      expect(result.map((p) => p.title)).toEqual(["revealed"]);
    });

    it("options を渡さないときは createdAt によるフィルタを行わない（後方互換）", async () => {
      const repo = createInMemoryPostRepository();
      const [post] = await repo.createMany("community-1", [
        {
          slotKey: "s",
          seq: 0,
          author: "w",
          title: "future",
          text: "t",
          createdAt: new Date("2999-01-01T00:00:00Z"),
        },
      ]);
      await repo.pinPost({ id: post!.id, pinnedAt: new Date() });
      const result = await repo.listPinnedByCommunity("community-1");
      expect(result).toHaveLength(1);
    });
  });

  describe("listByCommunityPaged の excludePostIds (#1089)", () => {
    it("excludePostIds で指定した id を結果から除外する", async () => {
      const repo = createInMemoryPostRepository();
      const posts = await repo.createMany("community-1", [
        { slotKey: "s", seq: 0, author: "w", title: "a", text: "t" },
        { slotKey: "s", seq: 1, author: "w", title: "b", text: "t" },
      ]);
      const result = await repo.listByCommunityPaged({
        communityId: "community-1",
        excludePostIds: [posts[1]!.id],
      });
      expect(result.posts.map((p) => p.title)).toEqual(["a"]);
    });

    it("excludePostIds 未指定時は従来どおり全件返す（後方互換）", async () => {
      const repo = createInMemoryPostRepository();
      await repo.createMany("community-1", [
        { slotKey: "s", seq: 0, author: "w", title: "a", text: "t" },
      ]);
      const result = await repo.listByCommunityPaged({ communityId: "community-1" });
      expect(result.posts).toHaveLength(1);
    });
  });

  describe("listByCommunityPopularPaged の excludePostIds (#1089)", () => {
    it("excludePostIds で指定した id を結果から除外する", async () => {
      const repo = createInMemoryPostRepository();
      const posts = await repo.createMany("community-1", [
        { slotKey: "s", seq: 0, author: "w", title: "a", text: "t" },
        { slotKey: "s", seq: 1, author: "w", title: "b", text: "t" },
      ]);
      await repo.addScore(posts[1]!.id, 10);
      const result = await repo.listByCommunityPopularPaged({
        communityId: "community-1",
        excludePostIds: [posts[1]!.id],
      });
      expect(result.posts.map((p) => p.title)).toEqual(["a"]);
    });
  });
});
