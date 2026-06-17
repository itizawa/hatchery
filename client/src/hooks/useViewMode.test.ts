import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useViewMode } from "./useViewMode.js";

describe("useViewMode", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
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
    expect(localStorage.getItem("feedViewMode")).toBe("compact");
  });

  it("localStorage に既存値がある場合、その値で初期化される", () => {
    localStorage.setItem("feedViewMode", "compact");
    const { result } = renderHook(() => useViewMode());
    expect(result.current.viewMode).toBe("compact");
  });
});
