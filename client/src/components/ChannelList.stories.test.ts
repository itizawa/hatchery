import { describe, expect, it } from "vitest";
import { ChannelList } from "./ChannelList";
import meta, * as stories from "./ChannelList.stories";

describe("ChannelList stories", () => {
  it("meta.component は ChannelList コンポーネントを指す", () => {
    expect(meta.component).toBe(ChannelList);
  });

  it("Default story がエクスポートされている", () => {
    expect(stories.Default).toBeDefined();
  });
});
