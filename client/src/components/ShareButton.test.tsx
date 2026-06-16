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

  it("コピー失敗（writeText が reject）時にエラーフィードバックが表示される", async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });
    render(<ShareButton shareUrl={SHARE_URL} shareTitle={SHARE_TITLE} />);
    await userEvent.click(screen.getByRole("button", { name: "共有" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "URL をコピー" }));
    expect(await screen.findByText("URL のコピーに失敗しました")).toBeInTheDocument();
  });

  it("コピー失敗時は成功 Snackbar（コピーしました）が表示されない", async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });
    render(<ShareButton shareUrl={SHARE_URL} shareTitle={SHARE_TITLE} />);
    await userEvent.click(screen.getByRole("button", { name: "共有" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "URL をコピー" }));
    expect(await screen.findByText("URL のコピーに失敗しました")).toBeInTheDocument();
    expect(screen.queryByText("URL をコピーしました")).not.toBeInTheDocument();
  });

  it("「X でシェア」をクリックすると X intent URL で外部リンク確認フローを経由する（#661: Provider 外では直接 window.open）", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<ShareButton shareUrl={SHARE_URL} shareTitle={SHARE_TITLE} />);
    await userEvent.click(screen.getByRole("button", { name: "共有" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "X でシェア" }));
    expect(openSpy).toHaveBeenCalledTimes(1);
    const calledUrl = (openSpy.mock.calls[0] as string[])[0];
    expect(calledUrl).toContain("https://twitter.com/intent/tweet");
    const xUrl = new URL(calledUrl);
    expect(xUrl.searchParams.get("url")).toBe(SHARE_URL);
    expect(xUrl.searchParams.get("text")).toContain(SHARE_TITLE);
    openSpy.mockRestore();
  });
});
