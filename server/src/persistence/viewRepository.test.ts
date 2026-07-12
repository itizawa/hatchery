import { describe, expect, it } from "vitest";

import { createInMemoryViewRepository } from "./viewRepository.js";

describe("createInMemoryViewRepository", () => {
  describe("recordPostView", () => {
    it("新規セッションの post 閲覧は isNew=true を返す", async () => {
      const repo = createInMemoryViewRepository();
      const result = await repo.recordPostView("post-1", "sess-1", null);
      expect(result.isNew).toBe(true);
    });

    it("同一 (postId, sessionId) の二重呼び出しは isNew=false（no-op）", async () => {
      const repo = createInMemoryViewRepository();
      await repo.recordPostView("post-1", "sess-1", null);
      const result = await repo.recordPostView("post-1", "sess-1", null);
      expect(result.isNew).toBe(false);
    });

    it("同一 postId でも sessionId が異なれば別扱い（isNew=true）", async () => {
      const repo = createInMemoryViewRepository();
      await repo.recordPostView("post-1", "sess-1", null);
      const result = await repo.recordPostView("post-1", "sess-2", null);
      expect(result.isNew).toBe(true);
    });

    it("同一 sessionId でも postId が異なれば別扱い（isNew=true）", async () => {
      const repo = createInMemoryViewRepository();
      await repo.recordPostView("post-1", "sess-1", null);
      const result = await repo.recordPostView("post-2", "sess-1", null);
      expect(result.isNew).toBe(true);
    });
  });

  describe("recordCommentViews", () => {
    it("新規セッションのコメント閲覧は newCount が commentIds.length と等しい", async () => {
      const repo = createInMemoryViewRepository();
      const result = await repo.recordCommentViews(["c1", "c2", "c3"], "sess-1", null);
      expect(result.newCount).toBe(3);
    });

    it("同一 (commentId, sessionId) は no-op（newCount は重複分を除いた件数）", async () => {
      const repo = createInMemoryViewRepository();
      await repo.recordCommentViews(["c1", "c2"], "sess-1", null);
      const result = await repo.recordCommentViews(["c1", "c3"], "sess-1", null);
      expect(result.newCount).toBe(1);
    });

    it("空配列は newCount=0 を返す", async () => {
      const repo = createInMemoryViewRepository();
      const result = await repo.recordCommentViews([], "sess-1", null);
      expect(result.newCount).toBe(0);
    });
  });

  describe("viewsByWorkerSince", () => {
    it("記録がない場合は空の Map を返す", async () => {
      const repo = createInMemoryViewRepository();
      const result = await repo.viewsByWorkerSince(new Date());
      expect(result.size).toBe(0);
    });

    it("post view の author で集計される", async () => {
      const repo = createInMemoryViewRepository(
        (type) => (type === "post" ? "worker-1" : null),
      );
      await repo.recordPostView("post-1", "sess-1", null);
      await repo.recordPostView("post-1", "sess-2", null);

      const since = new Date(Date.now() - 1000);
      const result = await repo.viewsByWorkerSince(since);
      expect(result.get("worker-1")).toBe(2);
    });

    it("comment view の author で集計される", async () => {
      const repo = createInMemoryViewRepository(
        (type) => (type === "comment" ? "worker-2" : null),
      );
      await repo.recordCommentViews(["c1", "c2"], "sess-1", null);

      const since = new Date(Date.now() - 1000);
      const result = await repo.viewsByWorkerSince(since);
      expect(result.get("worker-2")).toBe(2);
    });

    it("since より古い記録は除外される", async () => {
      const clock = { now: new Date("2026-01-01T00:00:00Z") };
      const repo = createInMemoryViewRepository(
        () => "worker-1",
        () => clock.now,
      );
      await repo.recordPostView("post-1", "sess-1", null);

      clock.now = new Date("2026-06-01T00:00:00Z");
      const since = new Date("2026-03-01T00:00:00Z");
      const result = await repo.viewsByWorkerSince(since);
      expect(result.get("worker-1")).toBeUndefined();
    });
  });

  describe("totalViewCount（#1113）", () => {
    it("記録がない場合は 0 を返す", async () => {
      const repo = createInMemoryViewRepository();
      expect(await repo.totalViewCount()).toBe(0);
    });

    it("post / comment の新規閲覧をまとめて累計する", async () => {
      const repo = createInMemoryViewRepository();
      await repo.recordPostView("post-1", "sess-1", null);
      await repo.recordPostView("post-1", "sess-2", null);
      await repo.recordCommentViews(["c1", "c2"], "sess-1", null);
      expect(await repo.totalViewCount()).toBe(4);
    });

    it("同一 (target, session) の重複閲覧は累計されない", async () => {
      const repo = createInMemoryViewRepository();
      await repo.recordPostView("post-1", "sess-1", null);
      await repo.recordPostView("post-1", "sess-1", null);
      expect(await repo.totalViewCount()).toBe(1);
    });
  });

  describe("viewCountByCommunity（#1113）", () => {
    it("記録がない場合は空の Map を返す", async () => {
      const repo = createInMemoryViewRepository();
      const result = await repo.viewCountByCommunity();
      expect(result.size).toBe(0);
    });

    it("resolveCommunity で解決した community 単位に集計する", async () => {
      const repo = createInMemoryViewRepository(
        undefined,
        undefined,
        // eslint-disable-next-line max-params
        (type, targetId) => (type === "post" ? `community-of-${targetId}` : null),
      );
      await repo.recordPostView("post-1", "sess-1", null);
      await repo.recordPostView("post-1", "sess-2", null);
      await repo.recordPostView("post-2", "sess-1", null);

      const result = await repo.viewCountByCommunity();
      expect(result.get("community-of-post-1")).toBe(2);
      expect(result.get("community-of-post-2")).toBe(1);
    });

    it("resolveCommunity が null を返すターゲットは集計対象外", async () => {
      const repo = createInMemoryViewRepository(undefined, undefined, () => null);
      await repo.recordPostView("post-1", "sess-1", null);

      const result = await repo.viewCountByCommunity();
      expect(result.size).toBe(0);
    });

    it("resolveCommunity 未注入のときは常に空の Map を返す", async () => {
      const repo = createInMemoryViewRepository();
      await repo.recordPostView("post-1", "sess-1", null);

      const result = await repo.viewCountByCommunity();
      expect(result.size).toBe(0);
    });
  });
});
