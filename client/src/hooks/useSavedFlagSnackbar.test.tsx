import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSavedFlagSnackbar } from "./useSavedFlagSnackbar.js";

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

describe("useSavedFlagSnackbar（#1080 / #1081）", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("flag が true のとき open が true になる", () => {
    const { result } = renderHook(() => useSavedFlagSnackbar({ flag: true, tab: "communities" }));
    expect(result.current.open).toBe(true);
  });

  it("flag が true のとき navigate でフラグを除去する（replace: true）", () => {
    renderHook(() => useSavedFlagSnackbar({ flag: true, tab: "communities" }));
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/admin",
      search: { tab: "communities" },
      replace: true,
    });
  });

  it("flag が undefined のとき open は false のまま", () => {
    const { result } = renderHook(() => useSavedFlagSnackbar({ flag: undefined, tab: "users" }));
    expect(result.current.open).toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("close() を呼ぶと open が false になる", () => {
    const { result } = renderHook(() => useSavedFlagSnackbar({ flag: true, tab: "users" }));
    expect(result.current.open).toBe(true);
    act(() => {
      result.current.close();
    });
    expect(result.current.open).toBe(false);
  });

  it("tab に応じて navigate の search.tab が切り替わる", () => {
    renderHook(() => useSavedFlagSnackbar({ flag: true, tab: "users" }));
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/admin",
      search: { tab: "users" },
      replace: true,
    });
  });
});
