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
});
