import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useHideOnScroll } from "./useHideOnScroll.js";

function mockReducedMotion(reduce: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion") ? reduce : false,
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

function scrollEvent(scrollTop: number) {
  return { currentTarget: { scrollTop } } as unknown as React.UIEvent<HTMLElement>;
}

// Issue #302: スクロール方向に応じた表示制御 hook
describe("useHideOnScroll (#302)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("初期状態では表示（hidden=false）", () => {
    mockReducedMotion(false);
    const { result } = renderHook(() => useHideOnScroll());
    expect(result.current.hidden).toBe(false);
  });

  it("下スクロールで hidden=true、上スクロールで hidden=false に切り替わる", () => {
    mockReducedMotion(false);
    const { result } = renderHook(() => useHideOnScroll());

    act(() => result.current.onScroll(scrollEvent(400)));
    expect(result.current.hidden).toBe(true);

    act(() => result.current.onScroll(scrollEvent(100)));
    expect(result.current.hidden).toBe(false);
  });

  it("prefers-reduced-motion: reduce では常に表示し onScroll でも非表示にならない", () => {
    mockReducedMotion(true);
    const { result } = renderHook(() => useHideOnScroll());

    expect(result.current.prefersReducedMotion).toBe(true);

    act(() => result.current.onScroll(scrollEvent(800)));
    expect(result.current.hidden).toBe(false);
  });
});
