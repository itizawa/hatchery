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

// eslint-disable-next-line max-params
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

// eslint-disable-next-line max-params
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
        return Promise.resolve(jsonResponse(200, { posts: [], nextCursor: null }));
      }
      if (url.includes("/api/subscriptions/unread-counts")) {
        return Promise.resolve(jsonResponse(200, { unread_counts: [] }));
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

  const searchRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/search",
    component: (): ReactElement => <RootLayout />,
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([
      indexRoute,
      communitiesRoute,
      communityRoute,
      adminRoute,
      termsRoute,
      privacyRoute,
      searchRoute,
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

  it("「ダッシュボード」が /dashboard へのリンクを持つ ListItemButton でレンダリングされる（#1113）", async () => {
    stubFetch(true);
    renderWithRouter("/");

    const dashboardLink = await screen.findByRole("link", { name: /ダッシュボード/ });
    expect(dashboardLink).toHaveAttribute("href", "/dashboard");
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

  it("/ ではホームがアクティブ（aria-current=page）", async () => {
    stubFetch(true);
    renderWithRouter("/");

    const homeLink = await screen.findByRole("link", { name: /ホーム/ });
    expect(homeLink).toHaveAttribute("aria-current", "page");
  });

  it("グローバルナビに「人気」リンクが存在しない（#1067）", async () => {
    stubFetch(true);
    renderWithRouter("/");

    await screen.findByRole("link", { name: /ホーム/ });
    expect(screen.queryByRole("link", { name: /人気/ })).not.toBeInTheDocument();
  });

  it("admin ユーザーにも「コミュニティを作る」リンクが表示されない (#560)", async () => {
    stubFetch(true, "admin");
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

  it("ドロワーを開くとホームメニューが表示される", async () => {
    stubFetch(true);
    renderWithRouter("/");

    const hamburger = await screen.findByRole("button", { name: /メニューを開く/ });
    await userEvent.click(hamburger);

    await screen.findByRole("navigation", { name: "サイドバー" });
    expect(await screen.findByRole("link", { name: /ホーム/ })).toBeInTheDocument();
  });
});

// 受け入れ条件 #514: モバイルドロワー内 nav の固定幅撤廃（見切れ防止）
describe("モバイルドロワー nav 幅追従（見切れ防止） (#514)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // モバイル幅をシミュレート
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

  it("ドロワーを開くとモバイル用 nav（data-testid=mobile-sidebar-nav）が表示される", async () => {
    stubFetch(true);
    renderWithRouter("/");

    const hamburger = await screen.findByRole("button", { name: /メニューを開く/ });
    await userEvent.click(hamburger);

    expect(await screen.findByTestId("mobile-sidebar-nav")).toBeInTheDocument();
  });

  it("ドロワーを開いたとき「探す」を含む全ナビ項目が mobile-sidebar-nav 内に表示される", async () => {
    stubFetch(true);
    renderWithRouter("/");

    const hamburger = await screen.findByRole("button", { name: /メニューを開く/ });
    await userEvent.click(hamburger);

    const mobileNav = await screen.findByTestId("mobile-sidebar-nav");
    // 「探す」（/communities）・ホームの全リンクが nav 内に存在する
    expect(mobileNav).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /探す/ })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /ホーム/ })).toBeInTheDocument();
  });

  it("mobile-sidebar-nav の style 属性に固定 width（インライン px 指定）が存在しない", async () => {
    stubFetch(true);
    renderWithRouter("/");

    const hamburger = await screen.findByRole("button", { name: /メニューを開く/ });
    await userEvent.click(hamburger);

    const mobileNav = await screen.findByTestId("mobile-sidebar-nav");
    // MUI の sx は CSS クラスに変換されるためインライン style には出力されない。
    // 直接 width をインラインで指定している場合のみ style 属性に現れる。
    const styleAttr = mobileNav.getAttribute("style") ?? "";
    expect(styleAttr).not.toMatch(/width\s*:\s*260px/);
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

  it("「Hatcheryとは？」が /about へのリンクで表示される", async () => {
    stubFetch(true);
    renderWithRouter("/");

    const aboutLink = await screen.findByRole("link", { name: /Hatcheryとは？/ });
    expect(aboutLink).toHaveAttribute("href", "/about");
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
    expect(await screen.findByRole("link", { name: /Hatcheryとは？/ })).toHaveAttribute("href", "/about");
    expect(await screen.findByRole("link", { name: /利用規約/ })).toHaveAttribute("href", "/terms");
    expect(await screen.findByRole("link", { name: /プライバシーポリシー/ })).toHaveAttribute("href", "/privacy");
  });
});

// 受け入れ条件 #691: 非管理者サイドバーDivider重複バグ修正
describe("サイドバー Divider 重複バグ修正 (#691)", () => {
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

  it("非管理者ユーザーのサイドバーで Divider が2本だけ表示される", async () => {
    stubFetch(true, "member");
    renderWithRouter("/");

    await screen.findByRole("link", { name: /ホーム/ });
    const separators = await screen.findAllByRole("separator");
    expect(separators).toHaveLength(2);
  });

  it("管理者ユーザーのサイドバーで Divider が3本表示される", async () => {
    stubFetch(true, "admin");
    renderWithRouter("/");

    await screen.findByRole("link", { name: /管理画面/ });
    const separators = await screen.findAllByRole("separator");
    expect(separators).toHaveLength(3);
  });

  it("未ログイン状態でも Divider が2本だけ表示される", async () => {
    stubFetch(false);
    renderWithRouter("/");

    await screen.findByRole("navigation", { name: "サイドバー" });
    await screen.findByRole("link", { name: /利用規約/ });
    const separators = await screen.findAllByRole("separator");
    expect(separators).toHaveLength(2);
  });
});
