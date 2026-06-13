import { createMemoryHistory } from "@tanstack/react-router";
import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppRoot } from "../AppRoot";
import { createAppRouter, type AppRouter } from "../router";

/** ログイン済みを表す /auth/me のレスポンスボディ（AuthUser）。 */
const AUTH_USER = { id: "testuser", displayName: "Test User", role: "admin" };

/** 各 Scene / サイドバーが呼ぶ fetch を最小応答する（router.test.tsx と同方針）。 */
function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: string | URL | Request) => {
      const urlStr = input instanceof Request ? input.url : String(input);
      if (urlStr.includes("/auth/me")) {
        return Promise.resolve(
          new Response(JSON.stringify(AUTH_USER), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      if (urlStr.includes("/api/communities") && !urlStr.includes("/feed") && !urlStr.includes("/subscribe")) {
        return Promise.resolve(
          new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }),
        );
      }
      if (urlStr.includes("/api/feed")) {
        return Promise.resolve(
          new Response(JSON.stringify({ posts: [], nextCursor: null }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }),
      );
    }),
  );
}

describe("SPA ルート遷移の Cloudflare ビーコン通知（useCfPageViewTracking / AppRoot 統合）", () => {
  let push: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    stubFetch();
    push = vi.fn();
    (window as { __cfBeacon?: { push: (e: unknown) => void } }).__cfBeacon = { push };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as { __cfBeacon?: unknown }).__cfBeacon;
  });

  // 受け入れ条件 #2: 初回ロードでは通知しない（ビーコン本体が自動計測するため二重計上を避ける）。
  it("初回ロードでは page 通知が発火しない", async () => {
    const router: AppRouter = createAppRouter({
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    render(<AppRoot router={router} />);
    await waitFor(() => expect(router.state.status).toBe("idle"));
    // 初回 onResolved は除外されるため push は呼ばれない。
    expect(push).not.toHaveBeenCalled();
  });

  // 受け入れ条件 #2: 遷移ごとに 1 回 page 通知が発火する。
  it("ルート遷移（/ → /communities）ごとに page 通知が 1 回発火する", async () => {
    const router: AppRouter = createAppRouter({
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    render(<AppRoot router={router} />);
    await waitFor(() => expect(router.state.status).toBe("idle"));
    expect(push).not.toHaveBeenCalled();

    await router.navigate({ to: "/communities" });
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenLastCalledWith({ type: "page" });

    await router.navigate({ to: "/popular" });
    await waitFor(() => expect(push).toHaveBeenCalledTimes(2));
  });

  // 受け入れ条件 #3: window.__cfBeacon 不在でも遷移で例外を投げず no-op。
  it("window.__cfBeacon 不在でも遷移時に例外を投げない", async () => {
    delete (window as { __cfBeacon?: unknown }).__cfBeacon;
    const router: AppRouter = createAppRouter({
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    render(<AppRoot router={router} />);
    await waitFor(() => expect(router.state.status).toBe("idle"));
    await expect(router.navigate({ to: "/communities" })).resolves.not.toThrow();
  });
});
