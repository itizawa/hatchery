import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CommunityCoverPlaceholder } from "./CommunityCoverPlaceholder.js";

describe("CommunityCoverPlaceholder（#1021）", () => {
  it("data-testid='community-cover-placeholder' を持つ SVG をレンダリングする", () => {
    render(<CommunityCoverPlaceholder id="comm-1" />);
    expect(screen.getByTestId("community-cover-placeholder")).toBeInTheDocument();
  });

  it("aria-hidden='true' で装飾的な SVG として扱われる", () => {
    render(<CommunityCoverPlaceholder id="comm-1" />);
    const svg = screen.getByTestId("community-cover-placeholder");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("同じ id を渡すと同じ fill 色（背景色）になる", () => {
    const { container: c1 } = render(<CommunityCoverPlaceholder id="comm-same" />);
    const { container: c2 } = render(<CommunityCoverPlaceholder id="comm-same" />);
    const fill1 = c1.querySelector("[data-testid='cover-bg-rect']")?.getAttribute("fill");
    const fill2 = c2.querySelector("[data-testid='cover-bg-rect']")?.getAttribute("fill");
    expect(fill1).toBeDefined();
    expect(fill1).toBe(fill2);
  });

  it("異なる id を渡すと fill 色か pattern が変わる（少なくとも bg か fg の違いが生じる）", () => {
    const { container: ca } = render(<CommunityCoverPlaceholder id="community-alpha" />);
    const { container: cb } = render(<CommunityCoverPlaceholder id="community-beta" />);
    const bgA = ca.querySelector("[data-testid='cover-bg-rect']")?.getAttribute("fill");
    const bgB = cb.querySelector("[data-testid='cover-bg-rect']")?.getAttribute("fill");
    const fgA = ca.querySelector("[data-testid='cover-pattern-rect']")?.getAttribute("fill");
    const fgB = cb.querySelector("[data-testid='cover-pattern-rect']")?.getAttribute("fill");
    expect(bgA !== bgB || fgA !== fgB).toBe(true);
  });

  it("height prop を受け取り SVG の height 属性に反映する", () => {
    render(<CommunityCoverPlaceholder id="comm-1" height={200} />);
    const svg = screen.getByTestId("community-cover-placeholder");
    expect(svg).toHaveAttribute("height", "200");
  });

  it("height を省略したとき 160 がデフォルト値になる", () => {
    render(<CommunityCoverPlaceholder id="comm-1" />);
    const svg = screen.getByTestId("community-cover-placeholder");
    expect(svg).toHaveAttribute("height", "160");
  });
});
