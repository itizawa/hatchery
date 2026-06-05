import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChannelListSkeleton } from "./ChannelListSkeleton";

describe("ChannelListSkeleton（#99）", () => {
  it("クラッシュせずにレンダリングできる", () => {
    const { container } = render(<ChannelListSkeleton />);
    expect(container.firstChild).not.toBeNull();
  });

  it("スケルトン要素を描画する", () => {
    render(<ChannelListSkeleton />);
    const skeletons = screen.getAllByTestId("channel-list-skeleton-item");
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });
});
