import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ShareButton } from "./ShareButton";

const SHARE_URL = "https://hatchery.example/communities/tech";
const SHARE_TITLE = "テックトーク";

describe("ShareButton", () => {
  it("「共有」ボタン（aria-label）が表示される", () => {
    render(<ShareButton shareUrl={SHARE_URL} shareTitle={SHARE_TITLE} />);
    expect(screen.getByRole("button", { name: "共有" })).toBeInTheDocument();
  });

  it("共有ボタン押下でメニューが開き「URL をコピー」「X でシェア」が表示される", async () => {
    render(<ShareButton shareUrl={SHARE_URL} shareTitle={SHARE_TITLE} />);
    await userEvent.click(screen.getByRole("button", { name: "共有" }));
    expect(await screen.findByRole("menuitem", { name: "URL をコピー" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "X でシェア" })).toBeInTheDocument();
  });

  it("「URL をコピー」押下で navigator.clipboard.writeText が shareUrl で呼ばれる", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });
    render(<ShareButton shareUrl={SHARE_URL} shareTitle={SHARE_TITLE} />);
    await userEvent.click(screen.getByRole("button", { name: "共有" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "URL をコピー" }));
    expect(writeTextMock).toHaveBeenCalledWith(SHARE_URL);
  });

  it("コピー成功後に完了フィードバック（Snackbar）が表示される", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });
    render(<ShareButton shareUrl={SHARE_URL} shareTitle={SHARE_TITLE} />);
    await userEvent.click(screen.getByRole("button", { name: "共有" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "URL をコピー" }));
    expect(await screen.findByText("URL をコピーしました")).toBeInTheDocument();
  });

  it("「X でシェア」が intent URL を href に持ち、text(title 含む)・url(shareUrl) を含み target=_blank / rel=noopener noreferrer を持つ", async () => {
    render(<ShareButton shareUrl={SHARE_URL} shareTitle={SHARE_TITLE} />);
    await userEvent.click(screen.getByRole("button", { name: "共有" }));
    const xShare = await screen.findByRole("menuitem", { name: "X でシェア" });
    const href = xShare.getAttribute("href") ?? "";
    expect(href).toContain("https://twitter.com/intent/tweet");
    const url = new URL(href);
    expect(url.searchParams.get("url")).toBe(SHARE_URL);
    expect(url.searchParams.get("text")).toContain(SHARE_TITLE);
    expect(xShare).toHaveAttribute("target", "_blank");
    expect(xShare).toHaveAttribute("rel", "noopener noreferrer");
  });
});
