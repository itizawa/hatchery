import { describe, expect, it, vi } from "vitest";

import type { WorkerAvatarCleanupClient } from "./cleanupDeadWorkerAvatarUrls.js";
import { runCleanupDeadWorkerAvatarUrls } from "./cleanupDeadWorkerAvatarUrls.js";

// runCleanupDeadWorkerAvatarUrls は DB 接続を狭いインターフェースに抽象化しているため、
// フェイクの WorkerAvatarCleanupClient を注入してユニットテストする（#1057）。

function createFakeClient(
  rows: Array<{ id: string; imageUrl: string | null }>,
): WorkerAvatarCleanupClient & { clearImageUrl: ReturnType<typeof vi.fn> } {
  const clearImageUrl = vi.fn().mockImplementation((ids: string[]) => Promise.resolve(ids.length));
  return {
    findWorkersWithImageUrl: vi.fn().mockResolvedValue(rows),
    clearImageUrl,
  };
}

describe("runCleanupDeadWorkerAvatarUrls (#1057)", () => {
  it("死んだ boringavatars URL を持つ worker の id のみを更新対象として抽出する", async () => {
    const client = createFakeClient([
      { id: "worker-dead-1", imageUrl: "https://source.boringavatars.com/beam/40/worker-dead-1" },
      { id: "worker-ok", imageUrl: "https://storage.googleapis.com/bucket/worker-ok.png" },
      { id: "worker-dead-2", imageUrl: "https://source.boringavatars.com/beam/40/worker-dead-2" },
    ]);

    const result = await runCleanupDeadWorkerAvatarUrls(client);

    expect(client.clearImageUrl).toHaveBeenCalledWith(["worker-dead-1", "worker-dead-2"]);
    expect(result).toEqual({ updatedCount: 2, updatedIds: ["worker-dead-1", "worker-dead-2"] });
  });

  it("正規のGCS URLやnullを持つworkerは更新対象に含めない", async () => {
    const client = createFakeClient([
      { id: "worker-ok", imageUrl: "https://storage.googleapis.com/bucket/worker-ok.png" },
    ]);

    const result = await runCleanupDeadWorkerAvatarUrls(client);

    expect(client.clearImageUrl).not.toHaveBeenCalled();
    expect(result).toEqual({ updatedCount: 0, updatedIds: [] });
  });

  it("対象が0件のとき clearImageUrl を呼ばず空の結果を返す", async () => {
    const client = createFakeClient([]);

    const result = await runCleanupDeadWorkerAvatarUrls(client);

    expect(client.clearImageUrl).not.toHaveBeenCalled();
    expect(result).toEqual({ updatedCount: 0, updatedIds: [] });
  });

  it("更新件数と対象id一覧を返す", async () => {
    const client = createFakeClient([
      { id: "worker-dead-1", imageUrl: "https://source.boringavatars.com/beam/40/worker-dead-1" },
    ]);

    const result = await runCleanupDeadWorkerAvatarUrls(client);

    expect(result.updatedCount).toBe(1);
    expect(result.updatedIds).toEqual(["worker-dead-1"]);
  });
});
