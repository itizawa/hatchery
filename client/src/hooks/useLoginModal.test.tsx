import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLoginModal } from "./useLoginModal.js";

const mockNavigate = vi.fn();
let mockSearch: Record<string, unknown> = {};

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useSearch: () => mockSearch,
}));

describe("useLoginModal (#588)", () => {
  beforeEach(() => {
    mockSearch = {};
    mockNavigate.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("login=true のとき isOpen が true を返す", () => {
    mockSearch = { login: true };
    const { result } = renderHook(() => useLoginModal());
    expect(result.current.isOpen).toBe(true);
  });

  it("login が未設定のとき isOpen が false を返す", () => {
    mockSearch = {};
    const { result } = renderHook(() => useLoginModal());
    expect(result.current.isOpen).toBe(false);
  });

  // #800: openLogin は login: 1（数値）を渡し /?login=1 を生成する（?login=true を避ける）。
  it("openLogin が既存の search param を保ったまま login:1 を付与する", () => {
    mockSearch = { foo: "bar" };
    const { result } = renderHook(() => useLoginModal());

    act(() => {
      result.current.openLogin();
    });

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith({
      to: ".",
      search: expect.any(Function),
    });

    const searchFn = mockNavigate.mock.calls[0][0].search as (
      prev: Record<string, unknown>
    ) => Record<string, unknown>;
    const prev = { foo: "bar", otherParam: "baz" };
    expect(searchFn(prev)).toEqual({ foo: "bar", otherParam: "baz", login: 1 });
  });

  it("closeLogin が login キーのみ削除し他を保持する", () => {
    mockSearch = { login: true };
    const { result } = renderHook(() => useLoginModal());

    act(() => {
      result.current.closeLogin();
    });

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith({
      to: ".",
      search: expect.any(Function),
    });

    const searchFn = mockNavigate.mock.calls[0][0].search as (
      prev: Record<string, unknown>
    ) => Record<string, unknown>;
    const prev = { login: true, foo: "bar", otherParam: "baz" };
    expect(searchFn(prev)).toEqual({ foo: "bar", otherParam: "baz" });
  });
});
