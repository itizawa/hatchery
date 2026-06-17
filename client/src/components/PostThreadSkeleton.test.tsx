import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PostThreadSkeleton } from "./PostThreadSkeleton";

describe("PostThreadSkeleton（#660）", () => {
  it('data-testid="post-thread-skeleton" が描画される', () => {
    render(<PostThreadSkeleton />);
    expect(screen.getByTestId("post-thread-skeleton")).toBeInTheDocument();
  });

  it("Skeleton 要素が複数描画される（MUI Skeleton import の整合性確認）", () => {
    const { container } = render(<PostThreadSkeleton />);
    const skeletons = container.querySelectorAll(".MuiSkeleton-root");
    expect(skeletons.length).toBeGreaterThan(1);
  });
});
