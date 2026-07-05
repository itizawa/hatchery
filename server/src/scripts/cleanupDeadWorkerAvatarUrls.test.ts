import { describe, expect, it } from "vitest";

import { createInMemoryWorkerRepository } from "../persistence/workerRepository.js";
import { runCleanupDeadWorkerAvatarUrls } from "./cleanupDeadWorkerAvatarUrls.js";

// runCleanupDeadWorkerAvatarUrls は永続化層の WorkerRepository に依存するため、
// 既存の createInMemoryWorkerRepository を注入して DB 接続なしでテストする（#1057）。

describe("runCleanupDeadWorkerAvatarUrls (#1057)", () => {
  it("死んだ boringavatars URL を持つ worker の id のみを更新対象として抽出し imageUrl を null にする", async () => {
    const repo = createInMemoryWorkerRepository([
      {
        id: "worker-dead-1",
        displayName: "死んだURLワーカー1",
        role: null,
        personality: null,
        imageUrl: "https://source.boringavatars.com/beam/40/worker-dead-1",
      },
      {
        id: "worker-ok",
        displayName: "正規URLワーカー",
        role: null,
        personality: null,
        imageUrl: "https://storage.googleapis.com/bucket/worker-ok.png",
      },
      {
        id: "worker-dead-2",
        displayName: "死んだURLワーカー2",
        role: null,
        personality: null,
        imageUrl: "https://source.boringavatars.com/beam/40/worker-dead-2",
      },
    ]);

    const result = await runCleanupDeadWorkerAvatarUrls(repo);

    expect(result).toEqual({ updatedCount: 2, updatedIds: ["worker-dead-1", "worker-dead-2"] });
    expect((await repo.findById("worker-dead-1"))?.imageUrl).toBeNull();
    expect((await repo.findById("worker-dead-2"))?.imageUrl).toBeNull();
    expect((await repo.findById("worker-ok"))?.imageUrl).toBe(
      "https://storage.googleapis.com/bucket/worker-ok.png",
    );
  });

  it("正規のGCS URLやnullを持つworkerは更新対象に含めない", async () => {
    const repo = createInMemoryWorkerRepository([
      {
        id: "worker-ok",
        displayName: "正規URLワーカー",
        role: null,
        personality: null,
        imageUrl: "https://storage.googleapis.com/bucket/worker-ok.png",
      },
      { id: "worker-no-image", displayName: "画像未設定ワーカー", role: null, personality: null },
    ]);

    const result = await runCleanupDeadWorkerAvatarUrls(repo);

    expect(result).toEqual({ updatedCount: 0, updatedIds: [] });
  });

  it("対象が0件のとき空の結果を返す", async () => {
    const repo = createInMemoryWorkerRepository([]);

    const result = await runCleanupDeadWorkerAvatarUrls(repo);

    expect(result).toEqual({ updatedCount: 0, updatedIds: [] });
  });

  it("論理削除済みの worker も更新対象に含める（#1057: 死んだURLは削除状態を問わずクリーンアップする）", async () => {
    const repo = createInMemoryWorkerRepository([
      {
        id: "worker-deleted",
        displayName: "削除済みワーカー",
        role: null,
        personality: null,
        imageUrl: "https://source.boringavatars.com/beam/40/worker-deleted",
        deletedAt: new Date("2026-01-01"),
      },
    ]);

    const result = await runCleanupDeadWorkerAvatarUrls(repo);

    expect(result).toEqual({ updatedCount: 1, updatedIds: ["worker-deleted"] });
  });
});
