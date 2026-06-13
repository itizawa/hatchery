import { describe, expect, it } from "vitest";

import { selectCommunityWorkers } from "./selectCommunityWorkers.js";

interface TestWorker {
  id: string;
}

describe("selectCommunityWorkers (#489)", () => {
  const haru: TestWorker = { id: "haru" };
  const ken: TestWorker = { id: "ken" };
  const mei: TestWorker = { id: "mei" };

  it("community に紐づくワーカーが 1 件以上ある場合はそれをそのまま返す", () => {
    const result = selectCommunityWorkers([haru, ken], [haru, ken, mei]);
    expect(result.map((w) => w.id)).toEqual(["haru", "ken"]);
  });

  it("community に紐づくワーカーが 0 件の場合は全 Bot ワーカーへフォールバックする", () => {
    const result = selectCommunityWorkers([], [haru, ken, mei]);
    expect(result.map((w) => w.id)).toEqual(["haru", "ken", "mei"]);
  });

  it("community 紐づきも全 Bot ワーカーも 0 件なら空配列を返す", () => {
    const result = selectCommunityWorkers([], []);
    expect(result).toEqual([]);
  });

  it("紐づきが 1 件でもフォールバックせず community のワーカーを優先する", () => {
    const result = selectCommunityWorkers([mei], [haru, ken, mei]);
    expect(result.map((w) => w.id)).toEqual(["mei"]);
  });
});
