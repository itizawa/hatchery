import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useViewMode } from "./useViewMode.js";

const STORAGE_KEY = "feedViewMode";

describe("useViewMode", () => {
  let mockStore: Record<string, string> = {};
  const localStorageMock = {
    getItem: (key: string) => mockStore[key] ?? null,
    // eslint-disable-next-line max-params
    setItem: (key: string, value: string) => {
      mockStore[key] = value;
    },
    removeItem: (key: string) => {
      delete mockStore[key];
    },
    clear: () => {
      mockStore = {};
    },
  };

  beforeEach(() => {
    mockStore = {};
    vi.stubGlobal("localStorage", localStorageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("初期値は 'card'（localStorage に値がない場合）", () => {
    const { result } = renderHook(() => useViewMode());
    expect(result.current.viewMode).toBe("card");
  });

  it("toggleViewMode() で 'card' → 'compact' に切り替わる", () => {
    const { result } = renderHook(() => useViewMode());
    act(() => {
      result.current.toggleViewMode();
    });
    expect(result.current.viewMode).toBe("compact");
  });

  it("'compact' から toggleViewMode() で 'card' に戻る", () => {
    const { result } = renderHook(() => useViewMode());
    act(() => {
      result.current.toggleViewMode();
    });
    act(() => {
      result.current.toggleViewMode();
    });
    expect(result.current.viewMode).toBe("card");
  });

  it("toggleViewMode() 後に localStorage の 'feedViewMode' にモードが保存される", () => {
    const { result } = renderHook(() => useViewMode());
    act(() => {
      result.current.toggleViewMode();
    });
    expect(localStorageMock.getItem(STORAGE_KEY)).toBe("compact");
  });

  it("localStorage に既存値がある場合、その値で初期化される", () => {
    localStorageMock.setItem(STORAGE_KEY, "compact");
    const { result } = renderHook(() => useViewMode());
    expect(result.current.viewMode).toBe("compact");
  });
});
