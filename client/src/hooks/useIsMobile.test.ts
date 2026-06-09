import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useIsMobile } from "./useIsMobile.js";

function mockMatchMedia(matchesMaxWidth: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: matchesMaxWidth ? query.includes("max-width") : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// 受け入れ条件 #277: useIsMobile hook
describe("useIsMobile (#277)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("モバイル幅（max-width にマッチ）のとき true を返す", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("デスクトップ幅（max-width にマッチしない）のとき false を返す", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });
});
