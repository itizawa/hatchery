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

describe("PostThreadSkeleton レイアウト構造 (#955)", () => {
  it("左カラムが data-testid='post-thread-skeleton-left' として描画される", () => {
    render(<PostThreadSkeleton />);
    expect(screen.getByTestId("post-thread-skeleton-left")).toBeInTheDocument();
  });

  it("右カラム（サイドバー相当）が data-testid='post-thread-skeleton-sidebar' として描画される", () => {
    render(<PostThreadSkeleton />);
    expect(screen.getByTestId("post-thread-skeleton-sidebar")).toBeInTheDocument();
  });

  it("左カラムと右カラムが同一フレックスコンテナー内に並んで描画される（2カラム構造）", () => {
    render(<PostThreadSkeleton />);
    const left = screen.getByTestId("post-thread-skeleton-left");
    const sidebar = screen.getByTestId("post-thread-skeleton-sidebar");
    expect(left.parentElement).toBe(sidebar.parentElement);
  });
});
