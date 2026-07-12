import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildFacebookShareUrl, buildLineShareUrl, ShareButton } from "./ShareButton";

const SHARE_URL = "https://hatchery.example/communities/tech";
const SHARE_TITLE = "テックトーク";

function defineNavigatorShare(share: ((data: ShareData) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, "share", {
    value: share,
    writable: true,
    configurable: true,
  });
}

describe("ShareButton", () => {
  afterEach(() => {
    defineNavigatorShare(undefined);
  });

  it("「共有」ボタン（aria-label）が表示される", () => {
    render(<ShareButton shareUrl={SHARE_URL} shareTitle={SHARE_TITLE} />);
    expect(screen.getByRole("button", { name: "共有" })).toBeInTheDocument();
  });

  it("共有ボタンは Chip（div[role=button]）としてレンダリングされる（#747）", () => {
    const { container } = render(<ShareButton shareUrl={SHARE_URL} shareTitle={SHARE_TITLE} />);
    const shareEl = container.querySelector('[aria-label="共有"]');
    expect(shareEl?.tagName).toBe("DIV");
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

  it("buildLineShareUrl が LINE の共有 URL を組み立てる", () => {
    const url = buildLineShareUrl({ shareUrl: SHARE_URL });
    expect(url).toBe(
      `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(SHARE_URL)}`,
    );
  });

  it("buildFacebookShareUrl が Facebook の共有 URL を組み立てる", () => {
    const url = buildFacebookShareUrl({ shareUrl: SHARE_URL });
    expect(url).toBe(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SHARE_URL)}`,
    );
  });

  it("共有メニューに「LINE でシェア」「Facebook でシェア」が表示される", async () => {
    render(<ShareButton shareUrl={SHARE_URL} shareTitle={SHARE_TITLE} />);
    await userEvent.click(screen.getByRole("button", { name: "共有" }));
    expect(await screen.findByRole("menuitem", { name: "LINE でシェア" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Facebook でシェア" })).toBeInTheDocument();
  });

  it("「LINE でシェア」をクリックすると LINE の共有 URL で外部リンクフローを経由する", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<ShareButton shareUrl={SHARE_URL} shareTitle={SHARE_TITLE} />);
    await userEvent.click(screen.getByRole("button", { name: "共有" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "LINE でシェア" }));
    expect(openSpy).toHaveBeenCalledTimes(1);
    const calledUrl = (openSpy.mock.calls[0] as string[])[0];
    expect(calledUrl).toBe(buildLineShareUrl({ shareUrl: SHARE_URL }));
    openSpy.mockRestore();
  });

  it("「Facebook でシェア」をクリックすると Facebook の共有 URL で外部リンクフローを経由する", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<ShareButton shareUrl={SHARE_URL} shareTitle={SHARE_TITLE} />);
    await userEvent.click(screen.getByRole("button", { name: "共有" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Facebook でシェア" }));
    expect(openSpy).toHaveBeenCalledTimes(1);
    const calledUrl = (openSpy.mock.calls[0] as string[])[0];
    expect(calledUrl).toBe(buildFacebookShareUrl({ shareUrl: SHARE_URL }));
    openSpy.mockRestore();
  });

  it("navigator.share が無い環境では「その他のアプリで共有」が表示されない", async () => {
    defineNavigatorShare(undefined);
    render(<ShareButton shareUrl={SHARE_URL} shareTitle={SHARE_TITLE} />);
    await userEvent.click(screen.getByRole("button", { name: "共有" }));
    await screen.findByRole("menuitem", { name: "URL をコピー" });
    expect(screen.queryByRole("menuitem", { name: "その他のアプリで共有" })).not.toBeInTheDocument();
  });

  it("navigator.share がある環境では「その他のアプリで共有」が表示され、クリックで navigator.share が呼ばれる", async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    defineNavigatorShare(shareMock);
    render(<ShareButton shareUrl={SHARE_URL} shareTitle={SHARE_TITLE} />);
    await userEvent.click(screen.getByRole("button", { name: "共有" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "その他のアプリで共有" }),
    );
    expect(shareMock).toHaveBeenCalledWith({ title: SHARE_TITLE, url: SHARE_URL });
  });
});
