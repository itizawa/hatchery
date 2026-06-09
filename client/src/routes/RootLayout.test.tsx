import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RootLayout } from "./RootLayout.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubFetch(isLoggedIn: boolean, role: "member" | "admin" = "member") {
  const user = isLoggedIn
    ? { id: "user1", displayName: "Alice", role }
    : undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/auth/me")) {
        return Promise.resolve(jsonResponse(isLoggedIn ? 200 : 401, user));
      }
      if (url.includes("/channels")) {
        return Promise.resolve(
          jsonResponse(200, [
            { id: "zatsudan", label: "雑談", type: "zatsudan" },
            { id: "shigoto", label: "仕事", type: "task" },
          ]),
        );
      }
      return Promise.resolve(jsonResponse(200, []));
    }),
  );
}

function renderWithRouter(initialPath = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<div>Loading...</div>}>
          <Outlet />
        </Suspense>
      </QueryClientProvider>
    ),
  });

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: (): ReactElement => (
      <RootLayout />
    ),
  });

  const channelRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/channels/$channelId",
    component: (): ReactElement => (
      <RootLayout />
    ),
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, channelRoute]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });

  return render(<RouterProvider router={router} />);
}

// 受け入れ条件 #190: RootLayout レスポンシブ対応
describe("RootLayout レスポンシブ対応 (#190)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("モバイル幅（md 未満）", () => {
    beforeEach(() => {
      // MUI の useMediaQuery は window.matchMedia を利用する。
      // md ブレークポイント（900px）未満をシミュレートするため、
      // max-width クエリに matches: true を返す。
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          // MUI は "(max-width:899.95px)" のような query を発行する
          matches: query.includes("max-width"),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    });

    it("ハンバーガーボタン（メニューを開く）が表示される", async () => {
      stubFetch(true);
      renderWithRouter("/");

      expect(await screen.findByRole("button", { name: /メニューを開く/ })).toBeInTheDocument();
    });

    it("初期状態ではドロワーが閉じている（サイドバー内容が非表示）", async () => {
      stubFetch(true);
      renderWithRouter("/");

      // ハンバーガーボタンが見えることを待機
      await screen.findByRole("button", { name: /メニューを開く/ });

      // ドロワーが閉じているとき、サイドバーの nav は表示されない
      expect(screen.queryByRole("navigation", { name: "サイドバー" })).not.toBeInTheDocument();
    });

    it("ハンバーガーボタンをクリックするとドロワーが開く", async () => {
      stubFetch(true);
      renderWithRouter("/");

      const hamburger = await screen.findByRole("button", { name: /メニューを開く/ });
      await userEvent.click(hamburger);

      // ドロワーが開くとサイドバー nav が表示される
      expect(await screen.findByRole("navigation", { name: "サイドバー" })).toBeInTheDocument();
    });

    it("チャンネルを選択するとドロワーが閉じる（ナビゲーション後の自動クローズ）", async () => {
      stubFetch(true);
      renderWithRouter("/");

      // ドロワーを開く
      const hamburger = await screen.findByRole("button", { name: /メニューを開く/ });
      await userEvent.click(hamburger);

      // サイドバーが表示されるのを待ってからチャンネルをクリック
      const channelLink = await screen.findByRole("link", { name: /雑談/ });
      await userEvent.click(channelLink);

      // ナビゲーション後にドロワーが閉じる（nav が非表示になる）
      await screen.findByRole("button", { name: /メニューを開く/ });
      expect(screen.queryByRole("navigation", { name: "サイドバー" })).not.toBeInTheDocument();
    });
  });

  describe("デスクトップ幅（md 以上）", () => {
    beforeEach(() => {
      // md 以上をシミュレート: max-width クエリには matches: false
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    });

    it("ハンバーガーボタンが表示されない", async () => {
      stubFetch(true);
      renderWithRouter("/");

      // 恒久サイドバーが表示されるまで待機
      await screen.findByRole("navigation", { name: "サイドバー" });

      expect(screen.queryByRole("button", { name: /メニューを開く/ })).not.toBeInTheDocument();
    });

    it("恒久サイドバー（nav aria-label=サイドバー）が表示される", async () => {
      stubFetch(true);
      renderWithRouter("/");

      expect(await screen.findByRole("navigation", { name: "サイドバー" })).toBeInTheDocument();
    });
  });
});

// 受け入れ条件 #273: サイドバー Divider・アイコン・hover スタイル
describe("サイドバーのナビゲーション改善 (#273)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // デスクトップ幅（恒久サイドバー表示）
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("SidebarChannelSection と仮想オフィスの間に Divider（role=separator）が表示される", async () => {
    stubFetch(true);
    renderWithRouter("/");

    await screen.findByRole("navigation", { name: "サイドバー" });
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("仮想オフィスが /office へのリンクを持つ ListItemButton でレンダリングされる", async () => {
    stubFetch(true);
    renderWithRouter("/");

    const officeLink = await screen.findByRole("link", { name: /仮想オフィス/ });
    expect(officeLink).toHaveAttribute("href", "/office");
  });

  it("admin ユーザーには管理画面が /admin へのリンクを持つ ListItemButton で表示される", async () => {
    stubFetch(true, "admin");
    renderWithRouter("/");

    const adminLink = await screen.findByRole("link", { name: /管理画面/ });
    expect(adminLink).toHaveAttribute("href", "/admin");
  });

  it("member ユーザーには管理画面リンクが表示されない", async () => {
    stubFetch(true, "member");
    renderWithRouter("/");

    await screen.findByRole("navigation", { name: "サイドバー" });
    expect(screen.queryByRole("link", { name: /管理画面/ })).not.toBeInTheDocument();
  });
});
