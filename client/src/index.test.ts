import { describe, expect, it } from "vitest";

import { channelCount } from "./index.js";

describe("@hatchery/client", () => {
  it("common の CHANNEL_IDS を参照してチャンネル数を返す (client → common)", () => {
    expect(channelCount()).toBe(3);
  });
});
