import { describe, expect, it } from "vitest";

import { channelCount } from "./index.js";

describe("@hatchery/client", () => {
  it("common の CHANNEL_IDS を参照する (client → common)", () => {
    expect(channelCount()).toBe(2);
  });
});
