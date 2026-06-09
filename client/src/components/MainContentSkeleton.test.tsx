import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MainContentSkeleton } from "./MainContentSkeleton";

describe("MainContentSkeleton（#241）", () => {
  it("クラッシュせずにレンダリングできる", () => {
    const { container } = render(<MainContentSkeleton />);
    expect(container.firstChild).not.toBeNull();
  });

  it("スケルトン要素（本文行）を描画する", () => {
    render(<MainContentSkeleton />);
    const items = screen.getAllByTestId("main-content-skeleton-item");
    expect(items).toHaveLength(5);
  });
});
