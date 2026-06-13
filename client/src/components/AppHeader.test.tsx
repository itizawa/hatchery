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

describe("AppHeader", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ログイン済みのとき displayName（名前テキスト）が表示されない", async () => {
    stubFetch(true);
    renderApp("/");

    await screen.findByRole("button", { name: /ユーザーメニュー/ });
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  });

  it("認証確認中（isPending）に Skeleton が表示される", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise(() => {})));
    renderApp("/channels/test-channel");

    expect(await screen.findByTestId("account-skeleton")).toBeInTheDocument();
  });

  it("初期表示時にアカウント設定が DOM 上に存在しない（Menu は闆じている）", async () => {
    stubFetch(true);
    renderApp("/");

    await screen.findByRole("button", { name: /ユーザーメニュー/ });

    expect(screen.queryByRole("menuitem", { name: /アカウント設定/ })).not.toBeInTheDocument();
  });

  it("初期表示時にログアウト menuitem が DOM 上に存在しない（Menu は闆じている）", async () => {
    stubFetch(true);
    renderApp("/");

    await screen.findByRole("button", { name: /ユーザーメニュー/ });

    expect(screen.queryByRole("menuitem", { name: /ログアウト/ })).not.toBeInTheDocument();
  });

  it("ユーザーメニュートリガーボタンが表示される", async () => {
    stubFetch(true);
    renderApp("/");

    expect(await screen.findByRole("button", { name: /ユーザーメニュー/ })).toBeInTheDocument();
  });

  it("トリガークリック後にアカウント設定 menuitem が表示される", async () => {
    stubFetch(true);
    renderApp("/");

    const trigger = await screen.findByRole("button", { name: /ユーザーメニュー/ });
    await userEvent.click(trigger);

    expect(await screen.findByRole("menuitem", { name: /アカウント設定/ })).toBeInTheDocument();
  });

  it("トリガークリック後にログアウト menuitem が表示される", async () => {
    stubFetch(true);
    renderApp("/");

    const trigger = await screen.findByRole("button", { name: /ユーザーメニュー/ });
    await userEvent.click(trigger);

    expect(await screen.findByRole("menuitem", { name: /ログアウト/ })).toBeInTheDocument();
  });

  it("ログアウト menuitem クリックで /auth/logout への POST リクエストが送信される", async () => {
    stubFetch(true);
    renderApp("/");

    const trigger = await screen.findByRole("button", { name: /ユーザーメニュー/ });
    await userEvent.click(trigger);

    const logoutItem = await screen.findByRole("menuitem", { name: /ログアウト/ });
    await userEvent.click(logoutItem);

    const fetchMock = vi.mocked(global.fetch);
    await waitFor(() => {
      const logoutCalls = fetchMock.mock.calls.filter(([input]) => {
        const url = input instanceof Request ? input.url : String(input);
        return url.includes("/auth/logout");
      });
      expect(logoutCalls.length).toBeGreaterThan(0);
    });
  });

  // #454: ログアウト後はゲスト向け公開ホームへ戻り、ログインモーダルは自動では開かない（ヘッダーにログイン導線が出る）。
  it("ログアウト成功後にゲスト表示（ヘッダーのログインリンク）に切り替わる", async () => {
    // ログアウト後の再フェッチで未ログイン（401）になるよう、呼び出しで状態を切り替える。
    let loggedIn = true;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url.includes("/auth/logout")) {
          loggedIn = false;
          return Promise.resolve(jsonResponse(200));
        }
        if (url.includes("/auth/me")) {
          return Promise.resolve(
            loggedIn ? jsonResponse(200, { id: "user1", displayName: "Alice" }) : jsonResponse(401),
          );
        }
        if (url.includes("/api/feed")) {
          return Promise.resolve(jsonResponse(200, { posts: [], nextCursor: null }));
        }
        return Promise.resolve(jsonResponse(200, []));
      }),
    );
    renderApp("/");

    const trigger = await screen.findByRole("button", { name: /ユーザーメニュー/ });
    await userEvent.click(trigger);

    const logoutItem = await screen.findByRole("menuitem", { name: /ログアウト/ });
    await userEvent.click(logoutItem);

    // ログインモーダル（heading "ログイン"）は開かず、ヘッダーのログインリンクが表示される。
    expect(await screen.findByRole("link", { name: /ログイン/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^ログイン$/ })).not.toBeInTheDocument();
  });

  // #454: ヘッダーのログインリンクをクリックすると、ページ遷移せずログインモーダルが開く（背景が保持される）。
  it("ログインリンクをクリックするとログインモーダルが開き、背景のコンテンツが保持される", async () => {
    stubFetch(false);
    renderApp("/");

    // 背景にホームフィードが描画されていることを確認（モーダルを開く前は role でも見つかる）。
    await screen.findByRole("heading", { name: /ホームフィード/ });
    const loginLink = await screen.findByRole("link", { name: /ログイン/ });
    await userEvent.click(loginLink);

    // モーダル（Google でログイン）が開く。
    expect(await screen.findByRole("button", { name: /Google でログイン/ })).toBeInTheDocument();
    // 背景のホームフィードは DOM 上に残ったまま（ページ遷移していない）。
    // モーダル展開後は背景が aria-hidden になるため role ではなく text で存在を確認する。
    expect(screen.getByText("ホームフィード")).toBeInTheDocument();
  });

  it("未ログイン時は displayName が表示されない", async () => {
    stubFetch(false);
    renderApp("/");

    await waitFor(() => {
      expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    });
  });

  it("未ログイン時はユーザーメニュートリガーが表示されない", async () => {
    stubFetch(false);
    renderApp("/");

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /ユーザーメニュー/ })).not.toBeInTheDocument();
    });
  });

  it("Hatchery ブランド名がヘッダーに表示される", async () => {
    stubFetch(true);
    renderApp("/");

    expect(await screen.findByRole("link", { name: /Hatchery/ })).toBeInTheDocument();
  });

  // Issue #255: 未認証ユーザーへのログイン誘導 UI
  it("未ログイン時にヘッダーにログインリンクが表示される", async () => {
    stubFetch(false);
    renderApp("/channels/zatsudan");

    expect(await screen.findByRole("link", { name: /ログイン/ })).toBeInTheDocument();
  });

  it("ログイン済み時にヘッダーにログインリンクが表示されない", async () => {
    stubFetch(true);
    renderApp("/");

    await screen.findByRole("button", { name: /ユーザーメニュー/ });
    expect(screen.queryByRole("link", { name: /ログイン/ })).not.toBeInTheDocument();
  });
});
