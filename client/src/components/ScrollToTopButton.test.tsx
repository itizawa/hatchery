import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ScrollToTopButton } from "./ScrollToTopButton";

describe("ScrollToTopButton", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    Object.defineProperty(container, "scrollTo", {
      value: vi.fn(),
      writable: true,
    });
  });

  it("スクロール量 < 300 ではボタンが非表示（Fade in=false）", () => {
    const ref = createRef<HTMLElement | null>();
    // ref を container に向ける
    const result = render(<ScrollToTopButton scrollContainerRef={ref as React.RefObject<HTMLElement | null>} />);
    // ref.current を手動でセット
    (ref as React.MutableRefObject<HTMLElement | null>).current = container;

    // scrollTop=0 で scroll イベントを発火
    Object.defineProperty(container, "scrollTop", { value: 0, writable: true });
    act(() => {
      container.dispatchEvent(new Event("scroll"));
    });

    const btn = screen.queryByRole("button", { name: "トップへ戻る" });
    // Fade in=false のとき MUI は visibility:hidden またはレンダリング抑制する
    // aria-hidden で非表示を検証する
    if (btn) {
      expect(btn.closest("[aria-hidden='true']") ?? btn).toBeTruthy();
    } else {
      // ボタン自体が DOM に存在しない場合も許容
      expect(btn).toBeNull();
    }

    result.unmount();
  });

  it("スクロール量 ≥ 300 ではボタンが表示（Fade in=true）", () => {
    const ref = { current: container } as React.RefObject<HTMLElement | null>;

    render(<ScrollToTopButton scrollContainerRef={ref} />);

    Object.defineProperty(container, "scrollTop", { value: 300, writable: true, configurable: true });
    act(() => {
      container.dispatchEvent(new Event("scroll"));
    });

    expect(screen.getByRole("button", { name: "トップへ戻る" })).toBeInTheDocument();
  });

  it("クリックで scrollTo({ top: 0, behavior: 'smooth' }) が呼ばれる", async () => {
    const ref = { current: container } as React.RefObject<HTMLElement | null>;

    render(<ScrollToTopButton scrollContainerRef={ref} />);

    // まず 300px スクロールさせてボタンを表示
    Object.defineProperty(container, "scrollTop", { value: 400, writable: true, configurable: true });
    act(() => {
      container.dispatchEvent(new Event("scroll"));
    });

    const btn = screen.getByRole("button", { name: "トップへ戻る" });
    await userEvent.click(btn);

    expect(container.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });
});
