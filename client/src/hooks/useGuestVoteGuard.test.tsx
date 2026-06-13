import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useGuestVoteGuard } from "./useGuestVoteGuard.js";
import * as authApi from "../api/auth.js";

function mockAuth(user: unknown) {
  vi.spyOn(authApi, "useAuth").mockReturnValue({
    data: user,
  } as ReturnType<typeof authApi.useAuth>);
}

describe("useGuestVoteGuard (#481)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("認証済みのとき guardVote は run() を実行し、誘導は開かない", () => {
    mockAuth({ id: "u1", displayName: "Alice", role: "member", email: "a@example.com" });
    const run = vi.fn();

    const { result } = renderHook(() => useGuestVoteGuard());

    act(() => result.current.guardVote(run));

    expect(run).toHaveBeenCalledTimes(1);
    expect(result.current.promptOpen).toBe(false);
  });

  it("未認証のとき guardVote は run() を実行せず、ログイン誘導を開く", () => {
    mockAuth(null);
    const run = vi.fn();

    const { result } = renderHook(() => useGuestVoteGuard());

    act(() => result.current.guardVote(run));

    expect(run).not.toHaveBeenCalled();
    expect(result.current.promptOpen).toBe(true);
  });

  it("認証状態未確定（undefined）のときも run() を実行せずログイン誘導を開く", () => {
    mockAuth(undefined);
    const run = vi.fn();

    const { result } = renderHook(() => useGuestVoteGuard());

    act(() => result.current.guardVote(run));

    expect(run).not.toHaveBeenCalled();
    expect(result.current.promptOpen).toBe(true);
  });

  it("closePrompt で誘導を閉じられる", () => {
    mockAuth(null);
    const run = vi.fn();

    const { result } = renderHook(() => useGuestVoteGuard());

    act(() => result.current.guardVote(run));
    expect(result.current.promptOpen).toBe(true);

    act(() => result.current.closePrompt());
    expect(result.current.promptOpen).toBe(false);
  });
});
