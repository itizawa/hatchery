import { describe, expect, it } from "vitest";

import { docsChannelCount } from "./index.js";

describe("@hatchery/docs", () => {
  it("client の channelCount を再利用する (docs → client)", () => {
    expect(docsChannelCount()).toBe(2);
  });
});
