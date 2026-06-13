import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";

import { createQueryClient } from "../queryClient.js";
import { createAppRouter } from "../router.js";

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * シェル（AppHeader/サイドバー）の useAuth（#461 で useSuspenseQuery 化・内部 fetchMe 参照のため
 * spy が届かない）と requireAdminRoute ガードが呼ぶ fetch を一括スタブする。未スタブだと
 * シェルの useAuth が実ネットワークへ出て失敗・throw するため、グローバル fetch を確実に固定する。
 */
function stubFetch(user: { id: string; displayName: string; role?: string } | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/auth/me")) {
        return Promise.resolve(jsonResponse(user ? 200 : 401, user ?? undefined));
      }
      if (url.includes("/api/feed")) {
        return Promise.resolve(jsonResponse(200, { posts: [], nextCursor: null }));
      }
      return Promise.resolve(jsonResponse(200, []));
    }),
  );
}

function renderApp(initialPath: string) {
  const queryClient = createQueryClient();
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("管理画面ガード", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("未ログイン状態で /admin にアクセスするとログイン画面が表示される", async () => {
    stubFetch(null);
    renderApp("/admin");
    expect(await screen.findByRole("heading", { name: /ログイン/ })).toBeInTheDocument();
  });

  it("ログイン済み状態で /admin にアクセスすると管理画面が表示される", async () => {
    stubFetch({ id: "user1", displayName: "Alice", role: "admin" });
    renderApp("/admin");
    expect(await screen.findByRole("heading", { name: /管理画面/ })).toBeInTheDocument();
  });
});

describe("ログイン画面（#455: Google 認証のみ）", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ログイン画面に Google でログインボタンが表示される", async () => {
    stubFetch(null);
    renderApp("/login");
    expect(await screen.findByRole("button", { name: /Google でログイン/ })).toBeInTheDocument();
  });

  it("ログイン画面に ID/パスワードフォームが存在しない（#455）", async () => {
    stubFetch(null);
    renderApp("/login");
    await screen.findByRole("button", { name: /Google でログイン/ });
    expect(screen.queryByLabelText(/ID/)).toBeNull();
    expect(screen.queryByLabelText(/パスワード/)).toBeNull();
  });
});
