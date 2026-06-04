import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "../queryClient.js";
import { createAppRouter } from "../router.js";

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** グローバル fetch をスタブしてログイン状態を制御する。 */
function stubFetch(isLoggedIn: boolean) {
  const user = isLoggedIn ? { id: "user1", displayName: "Alice" } : undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/auth/me")) {
        return Promise.resolve(jsonResponse(isLoggedIn ? 200 : 401, user));
      }
      if (url.includes("/auth/logout")) {
        return Promise.resolve(jsonResponse(200));
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

describe("UserFooter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ログイン済みのとき displayName が表示される", async () => {
    stubFetch(true);
    renderApp("/");

    expect(await screen.findByText("Alice")).toBeInTheDocument();
  });

  it("ログイン済みのときログアウトボタンが表示される", async () => {
    stubFetch(true);
    renderApp("/");

    expect(await screen.findByRole("button", { name: /ログアウト/ })).toBeInTheDocument();
  });

  it("ログアウトボタン押下で /auth/logout への POST リクエストが送信される", async () => {
    stubFetch(true);
    renderApp("/");

    const button = await screen.findByRole("button", { name: /ログアウト/ });
    await userEvent.click(button);

    const fetchMock = vi.mocked(global.fetch);
    await waitFor(() => {
      const logoutCalls = fetchMock.mock.calls.filter(([input]) => {
        const url = input instanceof Request ? input.url : String(input);
        return url.includes("/auth/logout");
      });
      expect(logoutCalls.length).toBeGreaterThan(0);
    });
  });

  it("ログアウト成功後に /login へ遷移する", async () => {
    stubFetch(true);
    renderApp("/");

    const button = await screen.findByRole("button", { name: /ログアウト/ });
    await userEvent.click(button);

    expect(await screen.findByRole("heading", { name: /ログイン/ })).toBeInTheDocument();
  });

  it("アカウント設定リンクが存在する", async () => {
    stubFetch(true);
    renderApp("/");

    expect(await screen.findByRole("link", { name: /アカウント設定/ })).toBeInTheDocument();
  });

  it("未ログイン時は displayName が表示されない", async () => {
    stubFetch(false);
    renderApp("/");

    await screen.findByRole("link", { name: "管理画面" });
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  });

  it("未ログイン時はログアウトボタンが表示されない", async () => {
    stubFetch(false);
    renderApp("/");

    await screen.findByRole("link", { name: "管理画面" });
    expect(screen.queryByRole("button", { name: /ログアウト/ })).not.toBeInTheDocument();
  });
});
