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
    const { result } = renderHook(() =>
      useSavedFlagSnackbar({ flag: true, flagKey: "communitySaved" }),
    );
    expect(result.current.open).toBe(true);
  });

  it("flag が true のとき navigate で replace 遷移する", () => {
    renderHook(() => useSavedFlagSnackbar({ flag: true, flagKey: "communitySaved" }));
    expect(mockNavigate).toHaveBeenCalledWith(expect.objectContaining({ replace: true }));
  });

  it("navigate の search updater は自分の flagKey だけを除去し他の search param を保持する", () => {
    renderHook(() => useSavedFlagSnackbar({ flag: true, flagKey: "communitySaved" }));
    const { search } = mockNavigate.mock.calls[0][0];
    expect(search({ tab: "communities", communitySaved: 1, workerSaved: 1 })).toEqual({
      tab: "communities",
      workerSaved: 1,
    });
  });

  it("flagKey に応じて除去する search key が切り替わる（別のsavedフラグは残す）", () => {
    renderHook(() => useSavedFlagSnackbar({ flag: true, flagKey: "workerSaved" }));
    const { search } = mockNavigate.mock.calls[0][0];
    expect(search({ tab: "users", workerSaved: 1, communitySaved: 1 })).toEqual({
      tab: "users",
      communitySaved: 1,
    });
  });

  it("flag が undefined のとき open は false のまま", () => {
    const { result } = renderHook(() =>
      useSavedFlagSnackbar({ flag: undefined, flagKey: "workerSaved" }),
    );
    expect(result.current.open).toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("close() を呼ぶと open が false になる", () => {
    const { result } = renderHook(() =>
      useSavedFlagSnackbar({ flag: true, flagKey: "workerSaved" }),
    );
    expect(result.current.open).toBe(true);
    act(() => {
      result.current.close();
    });
    expect(result.current.open).toBe(false);
  });
});
