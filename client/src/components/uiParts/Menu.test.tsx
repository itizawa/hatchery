import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Menu } from "./Menu";

describe("Menu (uiParts wrapper)", () => {
  it("Paper に border-radius: 12px が適用される", () => {
    const { baseElement } = render(
      <Menu anchorEl={document.body} open>
        <div>item</div>
      </Menu>,
    );
    const paper = baseElement.querySelector(".MuiMenu-paper");
    expect(paper).not.toBeNull();
    expect(window.getComputedStyle(paper!).borderRadius).toBe("12px");
  });

  it("Paper に弱い影（0 1px 4px rgba(0,0,0,0.08)）が適用される", () => {
    const { baseElement } = render(
      <Menu anchorEl={document.body} open>
        <div>item</div>
      </Menu>,
    );
    const paper = baseElement.querySelector(".MuiMenu-paper");
    expect(paper).not.toBeNull();
    const boxShadow = window.getComputedStyle(paper!).boxShadow;
    expect(boxShadow).toBe("0 1px 4px rgba(0,0,0,0.08)");
  });

  it("Paper に margin-top: 8px が適用される", () => {
    const { baseElement } = render(
      <Menu anchorEl={document.body} open>
        <div>item</div>
      </Menu>,
    );
    const paper = baseElement.querySelector(".MuiMenu-paper");
    expect(paper).not.toBeNull();
    expect(window.getComputedStyle(paper!).marginTop).toBe("8px");
  });

  it("呼び出し側が slotProps.paper.sx を追加渡ししても共通スタイルがマージされる", () => {
    const { baseElement } = render(
      <Menu anchorEl={document.body} open slotProps={{ paper: { sx: { color: "red" } } }}>
        <div>item</div>
      </Menu>,
    );
    const paper = baseElement.querySelector(".MuiMenu-paper");
    expect(paper).not.toBeNull();
    expect(window.getComputedStyle(paper!).borderRadius).toBe("12px");
    expect(window.getComputedStyle(paper!).color).toBe("rgb(255, 0, 0)");
  });

  it("children が正しくレンダリングされる", () => {
    render(
      <Menu anchorEl={document.body} open>
        <div>メニューアイテム</div>
      </Menu>,
    );
    expect(screen.getByText("メニューアイテム")).toBeInTheDocument();
  });
});
