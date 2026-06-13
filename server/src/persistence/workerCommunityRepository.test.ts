import { describe, expect, it } from "vitest";

import {
  createInMemoryWorkerCommunityRepository,
} from "./workerCommunityRepository.js";
import type { WorkerRecord } from "./workerRepository.js";

const haru: WorkerRecord = {
  id: "haru",
  displayName: "haru",
  role: "ムードメーカー",
  personality: null,
  imageUrl: null,
  deletedAt: null,
};
const ken: WorkerRecord = {
  id: "ken",
  displayName: "ken",
  role: "ベテラン",
  personality: null,
  imageUrl: null,
  deletedAt: null,
};
const deleted: WorkerRecord = {
  id: "old",
  displayName: "old",
  role: null,
  personality: null,
  imageUrl: null,
  deletedAt: new Date("2026-01-01"),
};

describe("createInMemoryWorkerCommunityRepository (#489)", () => {
  it("community に紐づく有効なワーカーを返す", async () => {
    const repo = createInMemoryWorkerCommunityRepository({
      workers: [haru, ken],
      links: [
        { workerId: "haru", communityId: "c1" },
        { workerId: "ken", communityId: "c1" },
      ],
    });

    const result = await repo.listWorkersByCommunity("c1");

    expect(result.map((w) => w.id).sort()).toEqual(["haru", "ken"]);
  });

  it("別 community の紐づきは含めない", async () => {
    const repo = createInMemoryWorkerCommunityRepository({
      workers: [haru, ken],
      links: [
        { workerId: "haru", communityId: "c1" },
        { workerId: "ken", communityId: "c2" },
      ],
    });

    const result = await repo.listWorkersByCommunity("c1");

    expect(result.map((w) => w.id)).toEqual(["haru"]);
  });

  it("紐づきが無い community では空配列を返す", async () => {
    const repo = createInMemoryWorkerCommunityRepository({
      workers: [haru],
      links: [{ workerId: "haru", communityId: "c1" }],
    });

    const result = await repo.listWorkersByCommunity("other");

    expect(result).toEqual([]);
  });

  it("論理削除済みワーカーは紐づいていても除外する", async () => {
    const repo = createInMemoryWorkerCommunityRepository({
      workers: [haru, deleted],
      links: [
        { workerId: "haru", communityId: "c1" },
        { workerId: "old", communityId: "c1" },
      ],
    });

    const result = await repo.listWorkersByCommunity("c1");

    expect(result.map((w) => w.id)).toEqual(["haru"]);
  });
});
