import { describe, expect, it, vi } from "vitest";

import { attachAuthorWorker, buildAuthorWorkerEnricher } from "./authorWorker.js";
import type { WorkerRecord, WorkerRepository } from "../persistence/workerRepository.js";

const workerA: WorkerRecord = {
  id: "worker-uuid-1",
  displayName: "haru",
  role: null,
  personality: null,
  verbosity: null,
  imageUrl: "https://example.com/haru.png",
  deletedAt: null,
};

const workerB: WorkerRecord = {
  id: "worker-uuid-2",
  displayName: "ken",
  role: null,
  personality: null,
  verbosity: null,
  imageUrl: null,
  deletedAt: null,
};

function makeRepo(workers: WorkerRecord[]): WorkerRepository {
  return {
    listBotWorkers: vi.fn().mockResolvedValue(workers),
  } as unknown as WorkerRepository;
}

describe("attachAuthorWorker", () => {
  it("空配列を渡すと [] を即返し、listBotWorkers は呼ばれない", async () => {
    const repo = makeRepo([workerA]);
    const result = await attachAuthorWorker({ records: [], workerRepo: repo });
    expect(result).toEqual([]);
    expect(repo.listBotWorkers).not.toHaveBeenCalled();
  });

  it("author が id で一致するとき author_worker が付く（#479）", async () => {
    const repo = makeRepo([workerA]);
    const posts = [{ id: "post-1", author: "worker-uuid-1" }];
    const result = await attachAuthorWorker({ records: posts, workerRepo: repo });
    expect(result[0].author_worker).toEqual({
      id: "worker-uuid-1",
      display_name: "haru",
      image_url: "https://example.com/haru.png",
    });
  });

  it("author が displayName で一致するとき author_worker が付く（#479）", async () => {
    const repo = makeRepo([workerA]);
    const posts = [{ id: "post-1", author: "haru" }];
    const result = await attachAuthorWorker({ records: posts, workerRepo: repo });
    expect(result[0].author_worker).toEqual({
      id: "worker-uuid-1",
      display_name: "haru",
      image_url: "https://example.com/haru.png",
    });
  });

  it("解決できない author のレコードには author_worker が付かない（client がフォールバック）", async () => {
    const repo = makeRepo([workerA]);
    const posts = [{ id: "post-1", author: "unknown-worker" }];
    const result = await attachAuthorWorker({ records: posts, workerRepo: repo });
    expect(result[0]).not.toHaveProperty("author_worker");
    expect(result[0].id).toBe("post-1");
  });

  it("imageUrl=null のワーカーは image_url が null になる（#1015: 死んだ URL を返さない）", async () => {
    const repo = makeRepo([workerB]);
    const posts = [{ id: "post-1", author: "worker-uuid-2" }];
    const result = await attachAuthorWorker({ records: posts, workerRepo: repo });
    expect(result[0].author_worker?.image_url).toBeNull();
  });

  it("解決できる author と解決できない author が混在する配列を正しく処理する", async () => {
    const repo = makeRepo([workerA]);
    const posts = [
      { id: "post-1", author: "worker-uuid-1" },
      { id: "post-2", author: "unknown-worker" },
    ];
    const result = await attachAuthorWorker({ records: posts, workerRepo: repo });
    expect(result[0].author_worker?.id).toBe("worker-uuid-1");
    expect(result[1]).not.toHaveProperty("author_worker");
    expect(result[1].id).toBe("post-2");
  });
});

describe("buildAuthorWorkerEnricher", () => {
  it("複数コレクションに enricher を適用しても listBotWorkers は 1 回だけ呼ばれる", async () => {
    const repo = makeRepo([workerA, workerB]);
    const enrich = await buildAuthorWorkerEnricher(repo);
    const posts = [{ id: "post-1", author: "worker-uuid-1" }];
    const comments = [{ id: "comment-1", author: "worker-uuid-2" }];
    const enrichedPosts = enrich(posts);
    const enrichedComments = enrich(comments);
    expect(enrichedPosts[0].author_worker?.id).toBe("worker-uuid-1");
    expect(enrichedComments[0].author_worker?.id).toBe("worker-uuid-2");
    expect(repo.listBotWorkers).toHaveBeenCalledTimes(1);
  });
});
