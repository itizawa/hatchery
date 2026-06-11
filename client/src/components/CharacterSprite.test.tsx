import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Worker } from "@hatchery/common";

import { CharacterSprite } from "./CharacterSprite";

const worker: Worker = { id: "haru", displayName: "haru", role: "ムードメーカー" };

const defaultProps = {
  worker,
  position: { x: 120, y: 80 },
  size: 48,
  onClick: () => {},
};

describe("CharacterSprite", () => {
  it("worker の displayName を aria-label に持つ button role の要素として描画される", () => {
    render(<CharacterSprite {...defaultProps} />);
    expect(screen.getByRole("button", { name: "haru" })).toBeInTheDocument();
  });

  it("position の x/y が left/top に、size が width/height に反映される", () => {
    render(<CharacterSprite {...defaultProps} />);
    const sprite = screen.getByRole("button", { name: "haru" });
    expect(sprite).toHaveStyle({
      left: "120px",
      top: "80px",
      width: "48px",
      height: "48px",
    });
  });

  it("クリックすると onClick がクリックされた要素を引数に呼ばれる", async () => {
    const handleClick = vi.fn();
    render(<CharacterSprite {...defaultProps} onClick={handleClick} />);
    const sprite = screen.getByRole("button", { name: "haru" });
    await userEvent.click(sprite);
    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith(sprite);
  });

  it("Enter キーで onClick が呼ばれる", () => {
    const handleClick = vi.fn();
    render(<CharacterSprite {...defaultProps} onClick={handleClick} />);
    const sprite = screen.getByRole("button", { name: "haru" });
    fireEvent.keyDown(sprite, { key: "Enter" });
    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith(sprite);
  });

  it("Space キーで onClick が呼ばれる", () => {
    const handleClick = vi.fn();
    render(<CharacterSprite {...defaultProps} onClick={handleClick} />);
    const sprite = screen.getByRole("button", { name: "haru" });
    fireEvent.keyDown(sprite, { key: " " });
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("Enter / Space 以外のキーでは onClick は呼ばれない", () => {
    const handleClick = vi.fn();
    render(<CharacterSprite {...defaultProps} onClick={handleClick} />);
    const sprite = screen.getByRole("button", { name: "haru" });
    fireEvent.keyDown(sprite, { key: "a" });
    fireEvent.keyDown(sprite, { key: "Escape" });
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("Tab フォーカス可能（tabIndex=0）である", () => {
    render(<CharacterSprite {...defaultProps} />);
    expect(screen.getByRole("button", { name: "haru" })).toHaveAttribute("tabindex", "0");
  });

  it("スプライト本体の SVG は装飾扱い（aria-hidden）で描画される", () => {
    const { container } = render(<CharacterSprite {...defaultProps} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("width", "48");
    expect(svg).toHaveAttribute("height", "48");
  });
});
