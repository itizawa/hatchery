import { describe, expect, it } from "vitest";

import { ChannelView } from "./ChannelView";
import meta, * as stories from "./ChannelView.stories";

describe("ChannelView stories", () => {
  it("meta.component は ChannelView コンポーネントを指す", () => {
    expect(meta.component).toBe(ChannelView);
  });

  it("Default story がエクスポートされている", () => {
    expect(stories.Default).toBeDefined();
  });

  it("Empty story がエクスポートされている", () => {
    expect(stories.Empty).toBeDefined();
  });
});
