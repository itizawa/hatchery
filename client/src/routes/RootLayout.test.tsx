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

const COMMUNITIES_DATA = [
  {
    id: "community-1",
    slug: "ai-dev",
    name: "AI 開発者の集い",
    description: "",
    created_at: "2026-06-01T00:00:00Z",
  },
];

function stubFetch(isLoggedIn: boolean, role: "member" | "admin" = "member") {
  const user = isLoggedIn ? { id: "user1", displayName: "Alice", role } : undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/auth/me")) {
        return Promise.resolve(jsonResponse(isLoggedIn ? 200 : 401, user));
      }
      if (
        url.includes("/api/communities") &&
        !url.includes("/feed") &&
        !url.includes("/subscribe")
      ) {
        return Promise.resolve(jsonResponse(200, COMMUNITIES_DATA));
      }
      if (url.includes("/api/feed")) {
        return Promise.resolve(jsonResponse(200, []));
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
    component: (): ReactElement => <RootLayout />,
  });

  const communitiesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/communities",
    component: (): ReactElement => <RootLayout />,
  });

  const communityRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/communities/$slug",
    component: (): ReactElement => <RootLayout />,
  });

  const popularRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/popular",
    component: (): ReactElement => <RootLayout />,
  });

  const adminRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/admin",
    component: (): ReactElement => <RootLayout />,
  });

  // 受け入れ条件 #484: サイドバーの利用規約・プライバシーポリシーリンクの遷移先。
  const termsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/terms",
    component: (): ReactElement => (
      <RootLayout />
    ),
  });

  const privacyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/privacy",
    component: (): ReactElement => (
      <RootLayout />
    ),
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([
      indexRoute,
      communitiesRoute,
      communityRoute,
      popularRoute,
      adminRoute,
      termsRoute,
      privacyRoute,
    ]),
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

    it("コミュニティリンクをクリックするとドロワーが閉じる（ナビゲーション後の自動クローズ）", async () => {
      stubFetch(true);
      renderWithRouter("/");

      // ドロワーを開く
      const hamburger = await screen.findByRole("button", { name: /メニューを開く/ });
      await userEvent.click(hamburger);

      // サイドバーが表示されるのを待ってから「探す」リンクをクリック
      const exploreLink = await screen.findByRole("link", { name: /探す/ });
      await userEvent.click(exploreLink);

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

// 受け入れ条件 #307: サイドバーのナビゲーション（Reddit 風）
describe("サイドバーのナビゲーション (#307)", () => {
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

  it("SidebarCommunitySection と admin リストの間に Divider（role=separator）が表示される", async () => {
    stubFetch(true);
    renderWithRouter("/");

    await screen.findByRole("navigation", { name: "サイドバー" });
    // #435 でグローバルナビ追加に伴い Divider が複数になった。
    // #461: サイドバー内容は useAuth（useSuspenseQuery）解決後に描画されるため findAllBy で待つ。
    expect((await screen.findAllByRole("separator")).length).toBeGreaterThanOrEqual(1);
  });

  it("「探す」が /communities へのリンクを持つ ListItemButton でレンダリングされる", async () => {
    stubFetch(true);
    renderWithRouter("/");

    const exploreLink = await screen.findByRole("link", { name: /探す/ });
    expect(exploreLink).toHaveAttribute("href", "/communities");
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
    // #461: サイドバー内容は useAuth 解決後に描画される。ナビ項目（ホーム）が出てから不在を判定する。
    await screen.findByRole("link", { name: /ホーム/ });
    expect(screen.queryByRole("link", { name: /管理画面/ })).not.toBeInTheDocument();
  });
});

// 受け入れ条件 #279: 横オーバーフロー防止
describe("横オーバーフロー防止 (#279)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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

  it("トップレベルコンテナ（data-testid='root-layout-outer'）がレンダリングされる", async () => {
    stubFetch(true);
    renderWithRouter("/");

    await screen.findByRole("navigation", { name: "サイドバー" });
    expect(screen.getByTestId("root-layout-outer")).toBeInTheDocument();
  });

  it("デスクトップ幅でサイドバーと main 要素が共存する", async () => {
    stubFetch(true);
    renderWithRouter("/");

    await screen.findByRole("navigation", { name: "サイドバー" });
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});

// 受け入れ条件 #435: Reddit 風グローバルナビゲーションメニュー
describe("グローバルナビゲーションメニュー (#435)", () => {
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

  it("「ホーム」が / へのリンクで表示される", async () => {
    stubFetch(true);
    renderWithRouter("/");

    const homeLink = await screen.findByRole("link", { name: /ホーム/ });
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("「人気」が /popular へのリンクで表示される", async () => {
    stubFetch(true);
    renderWithRouter("/");

    const popularLink = await screen.findByRole("link", { name: /人気/ });
    expect(popularLink).toHaveAttribute("href", "/popular");
  });

  it("/ ではホームがアクティブ（aria-current=page）・人気は非アクティブ", async () => {
    stubFetch(true);
    renderWithRouter("/");

    const homeLink = await screen.findByRole("link", { name: /ホーム/ });
    const popularLink = await screen.findByRole("link", { name: /人気/ });
    expect(homeLink).toHaveAttribute("aria-current", "page");
    expect(popularLink).not.toHaveAttribute("aria-current", "page");
  });

  it("/popular では人気がアクティブ（aria-current=page）・ホームは非アクティブ", async () => {
    stubFetch(true);
    renderWithRouter("/popular");

    const homeLink = await screen.findByRole("link", { name: /ホーム/ });
    const popularLink = await screen.findByRole("link", { name: /人気/ });
    expect(popularLink).toHaveAttribute("aria-current", "page");
    expect(homeLink).not.toHaveAttribute("aria-current", "page");
  });

  it("admin ユーザーには「コミュニティを作る」が表示され /admin へ導線する", async () => {
    stubFetch(true, "admin");
    renderWithRouter("/");

    const createLink = await screen.findByRole("link", { name: /コミュニティを作る/ });
    expect(createLink.getAttribute("href")).toContain("/admin");
  });

  it("member ユーザーには「コミュニティを作る」が表示されない", async () => {
    stubFetch(true, "member");
    renderWithRouter("/");

    await screen.findByRole("navigation", { name: "サイドバー" });
    // #461: サイドバー内容は useAuth 解決後に描画される。ナビ項目（ホーム）が出てから不在を判定する。
    await screen.findByRole("link", { name: /ホーム/ });
    expect(screen.queryByRole("link", { name: /コミュニティを作る/ })).not.toBeInTheDocument();
  });

  it("未ログインユーザーには「コミュニティを作る」が表示されない", async () => {
    stubFetch(false);
    renderWithRouter("/");

    await screen.findByRole("navigation", { name: "サイドバー" });
    // #461: サイドバー内容は useAuth 解決後に描画される。ナビ項目（ホーム）が出てから不在を判定する。
    await screen.findByRole("link", { name: /ホーム/ });
    expect(screen.queryByRole("link", { name: /コミュニティを作る/ })).not.toBeInTheDocument();
  });
});

// 受け入れ条件 #435-7: モバイルドロワーでもナビメニューが表示される
describe("グローバルナビゲーションメニュー（モバイルドロワー） (#435)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
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

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ドロワーを開くとホーム・人気メニューが表示される", async () => {
    stubFetch(true);
    renderWithRouter("/");

    const hamburger = await screen.findByRole("button", { name: /メニューを開く/ });
    await userEvent.click(hamburger);

    await screen.findByRole("navigation", { name: "サイドバー" });
    expect(await screen.findByRole("link", { name: /ホーム/ })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /人気/ })).toBeInTheDocument();
  });
});

// 受け入れ条件 #484-4,5: サイドバー下部のリーガルリンク（利用規約・プライバシーポリシー）
describe("リーガルリンク（利用規約・プライバシーポリシー） (#484)", () => {
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

  it("「利用規約」が /terms へのリンクで表示される", async () => {
    stubFetch(true);
    renderWithRouter("/");

    const termsLink = await screen.findByRole("link", { name: /利用規約/ });
    expect(termsLink).toHaveAttribute("href", "/terms");
  });

  it("「プライバシーポリシー」が /privacy へのリンクで表示される", async () => {
    stubFetch(true);
    renderWithRouter("/");

    const privacyLink = await screen.findByRole("link", { name: /プライバシーポリシー/ });
    expect(privacyLink).toHaveAttribute("href", "/privacy");
  });

  it("未ログインユーザーにもリーガルリンクが表示される（全ユーザー参照可）", async () => {
    stubFetch(false);
    renderWithRouter("/");

    await screen.findByRole("navigation", { name: "サイドバー" });
    expect(await screen.findByRole("link", { name: /利用規約/ })).toHaveAttribute("href", "/terms");
    expect(await screen.findByRole("link", { name: /プライバシーポリシー/ })).toHaveAttribute("href", "/privacy");
  });
});
