import { describe, it } from "vitest";

describe("@hatchery/docs", () => {
  it("モジュールとして正常にインポートできる", async () => {
    await import("./index.js");
  });
});
