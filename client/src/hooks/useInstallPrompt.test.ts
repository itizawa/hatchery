import { act, renderHook } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InstallPromptProvider, useInstallPrompt } from "./useInstallPrompt.js";

const DISMISS_KEY = "hatchery:pwa-install-dismissed";
const UPVOTE_KEY = "hatchery:pwa-install-upvoted";

const wrapper = ({ children }: { children: unknown }) =>
  createElement(InstallPromptProvider, null, children);

function makeLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    // eslint-disable-next-line max-params
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() { return Object.keys(store).length; },
  };
}

describe("useInstallPrompt", () => {
  beforeEach(() => {
    // #932: Node.js 26 環境で window.localStorage が undefined になるため stub で確保する。
    vi.stubGlobal("localStorage", makeLocalStorageMock());
    // スタンドアロン起動でないと見せかける
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
    // iOS でない
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("初期状態: isInstallable は false（beforeinstallprompt 未受信）", () => {
    const { result } = renderHook(() => useInstallPrompt(), { wrapper });
    expect(result.current.isInstallable).toBe(false);
  });

  it("beforeinstallprompt 受信後: isInstallable が true になる", () => {
    const { result } = renderHook(() => useInstallPrompt(), { wrapper });

    act(() => {
      const event = new Event("beforeinstallprompt");
      (event as unknown as { prompt: () => Promise<{ outcome: string }> }).prompt = vi.fn().mockResolvedValue({ outcome: "accepted" });
      window.dispatchEvent(event);
    });

    expect(result.current.isInstallable).toBe(true);
  });

  it("notifyScrolledPast を 3 回呼ぶ前は shouldShowSnackbar が false", () => {
    const { result } = renderHook(() => useInstallPrompt(), { wrapper });

    act(() => {
      const event = new Event("beforeinstallprompt");
      (event as unknown as { prompt: () => Promise<{ outcome: string }> }).prompt = vi.fn();
      window.dispatchEvent(event);
    });
    act(() => result.current.notifyScrolledPast());
    act(() => result.current.notifyScrolledPast());

    expect(result.current.shouldShowSnackbar).toBe(false);
  });

  it("notifyScrolledPast を 3 回呼ぶと shouldShowSnackbar が true になる", () => {
    const { result } = renderHook(() => useInstallPrompt(), { wrapper });

    act(() => {
      const event = new Event("beforeinstallprompt");
      (event as unknown as { prompt: () => Promise<{ outcome: string }> }).prompt = vi.fn();
      window.dispatchEvent(event);
    });
    act(() => result.current.notifyScrolledPast());
    act(() => result.current.notifyScrolledPast());
    act(() => result.current.notifyScrolledPast());

    expect(result.current.shouldShowSnackbar).toBe(true);
  });

  it("notifyFirstUpvote を呼ぶと shouldShowSnackbar が true になる", () => {
    const { result } = renderHook(() => useInstallPrompt(), { wrapper });

    act(() => {
      const event = new Event("beforeinstallprompt");
      (event as unknown as { prompt: () => Promise<{ outcome: string }> }).prompt = vi.fn();
      window.dispatchEvent(event);
    });
    act(() => result.current.notifyFirstUpvote());

    expect(result.current.shouldShowSnackbar).toBe(true);
    expect(window.localStorage.getItem(UPVOTE_KEY)).toBe("true");
  });

  it("notifyFirstUpvote を複数回呼んでも localStorage.setItem は 1 回だけ呼ばれる", () => {
    const setItemSpy = vi.spyOn(window.localStorage, "setItem");
    const { result } = renderHook(() => useInstallPrompt(), { wrapper });

    act(() => {
      const event = new Event("beforeinstallprompt");
      (event as unknown as { prompt: () => Promise<{ outcome: string }> }).prompt = vi.fn();
      window.dispatchEvent(event);
    });
    act(() => result.current.notifyFirstUpvote());
    act(() => result.current.notifyFirstUpvote());
    act(() => result.current.notifyFirstUpvote());

    expect(setItemSpy).toHaveBeenCalledTimes(1);
  });

  it("dismissSnackbar を呼ぶと shouldShowSnackbar が false になり localStorage に保存される", () => {
    const { result } = renderHook(() => useInstallPrompt(), { wrapper });

    act(() => {
      const event = new Event("beforeinstallprompt");
      (event as unknown as { prompt: () => Promise<{ outcome: string }> }).prompt = vi.fn();
      window.dispatchEvent(event);
    });
    act(() => result.current.notifyFirstUpvote());
    expect(result.current.shouldShowSnackbar).toBe(true);

    act(() => result.current.dismissSnackbar());
    expect(result.current.shouldShowSnackbar).toBe(false);
    expect(window.localStorage.getItem(DISMISS_KEY)).toBe("true");
  });

  it("localStorage に dismiss が保存済みなら初期状態から shouldShowSnackbar が false のまま", () => {
    window.localStorage.setItem(DISMISS_KEY, "true");
    const { result } = renderHook(() => useInstallPrompt(), { wrapper });

    act(() => {
      const event = new Event("beforeinstallprompt");
      (event as unknown as { prompt: () => Promise<{ outcome: string }> }).prompt = vi.fn();
      window.dispatchEvent(event);
    });
    act(() => result.current.notifyFirstUpvote());

    expect(result.current.shouldShowSnackbar).toBe(false);
  });

  it("appinstalled イベント受信後: isInstalled が true になり shouldShowSnackbar が false のまま", () => {
    const { result } = renderHook(() => useInstallPrompt(), { wrapper });

    act(() => {
      const event = new Event("beforeinstallprompt");
      (event as unknown as { prompt: () => Promise<{ outcome: string }> }).prompt = vi.fn();
      window.dispatchEvent(event);
    });
    act(() => result.current.notifyFirstUpvote());
    expect(result.current.isInstallable).toBe(true);

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    expect(result.current.isInstalled).toBe(true);
    expect(result.current.shouldShowSnackbar).toBe(false);
  });

  it("standalone 起動（matchMedia matches）では shouldShowSnackbar が false のまま", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });

    const { result } = renderHook(() => useInstallPrompt(), { wrapper });

    act(() => {
      const event = new Event("beforeinstallprompt");
      (event as unknown as { prompt: () => Promise<{ outcome: string }> }).prompt = vi.fn();
      window.dispatchEvent(event);
    });
    act(() => result.current.notifyFirstUpvote());

    expect(result.current.shouldShowSnackbar).toBe(false);
  });

  it("promptInstall を呼ぶと deferred prompt の prompt() が呼ばれ isInstallable が false になる", async () => {
    const mockPrompt = vi.fn().mockResolvedValue({ outcome: "dismissed" });
    const { result } = renderHook(() => useInstallPrompt(), { wrapper });

    act(() => {
      const event = new Event("beforeinstallprompt");
      (event as unknown as { prompt: () => Promise<{ outcome: string }> }).prompt = mockPrompt;
      window.dispatchEvent(event);
    });

    expect(result.current.isInstallable).toBe(true);

    await act(async () => {
      await result.current.promptInstall();
    });

    expect(mockPrompt).toHaveBeenCalledOnce();
    // dismiss 後も ref がクリアされ isInstallable が false になる
    expect(result.current.isInstallable).toBe(false);
  });

  it("iOS UA の場合 isIOS が true になる", () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    });

    const { result } = renderHook(() => useInstallPrompt(), { wrapper });
    expect(result.current.isIOS).toBe(true);
    // beforeinstallprompt なしでも isInstallable = true（iOS のため）
    expect(result.current.isInstallable).toBe(true);
  });

  it("openIosInstructions/closeIosInstructions で iosDialogOpen が切り替わる", () => {
    const { result } = renderHook(() => useInstallPrompt(), { wrapper });

    expect(result.current.iosDialogOpen).toBe(false);

    act(() => result.current.openIosInstructions());
    expect(result.current.iosDialogOpen).toBe(true);

    act(() => result.current.closeIosInstructions());
    expect(result.current.iosDialogOpen).toBe(false);
  });
});
