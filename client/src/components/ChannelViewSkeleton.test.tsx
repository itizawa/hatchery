import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChannelViewSkeleton } from "./ChannelViewSkeleton";

describe("ChannelViewSkeleton（#99）", () => {
  it("クラッシュせずにレンダリングできる", () => {
    const { container } = render(<ChannelViewSkeleton />);
    expect(container.firstChild).not.toBeNull();
  });

  it("スケルトン要素を描画する", () => {
    render(<ChannelViewSkeleton />);
    const skeletons = screen.getAllByTestId("channel-view-skeleton-item");
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });
});
