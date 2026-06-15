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
import { Suspense, lazy, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthLayout } from "./AuthLayout.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * AuthLayout 配下の各 Scene / サイドバーが呼びうる fetch を応答する。
 * isLoggedIn=true なら /auth/me → 200、false なら 401。
 * AuthLayout 自体は認証状態に依存しないが、jsdom 由来のネットワークエラーを避けるためスタブする。
 */
function stubFetch(isLoggedIn: boolean) {
  const user = isLoggedIn ? { id: "user1", displayName: "Alice", role: "member" } : undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/auth/me")) {
        return Promise.resolve(jsonResponse(isLoggedIn ? 200 : 401, user));
      }
      return Promise.resolve(jsonResponse(200, []));
    }),
  );
}

/**
 * AuthLayout を子ルート（Outlet あり）にマウントする最小ルータを memory history で構築する。
 * RootLayout.test.tsx の renderWithRouter パターンを踏襲する（受け入れ条件 #467-5）。
 *
 * `child` で AuthLayout 配下のルート（/）に描画する要素を差し替えられる。
 */
function renderWithRouter(child: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <AuthLayout />
      </QueryClientProvider>
    ),
  });

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: (): ReactElement => child,
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });

  return render(<RouterProvider router={router} />);
}

describe("AuthLayout（LP 専用レイアウト・認証境界） (#467)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // jsdom の useMediaQuery 互換のため matchMedia をスタブ（RootLayout.test.tsx に倣う）。
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

  // 受け入れ条件 #467-3: 子要素（Outlet）が描画される。
  it("子ルート（Outlet）のコンテンツを描画する", async () => {
    stubFetch(true);
    renderWithRouter(<div>子コンテンツ</div>);

    expect(await screen.findByText("子コンテンツ")).toBeInTheDocument();
  });

  // AuthLayout は RootLayout と異なりサイドバーを持たない LP 専用レイアウトである（識別契約）。
  it("サイドバー（navigation: サイドバー）を描画しない", async () => {
    stubFetch(true);
    renderWithRouter(<div>子コンテンツ</div>);

    await screen.findByText("子コンテンツ");
    expect(screen.queryByRole("navigation", { name: "サイドバー" })).not.toBeInTheDocument();
  });

  // 受け入れ条件 #467-2 の翻訳: AuthLayout 自体は認証ガードではない（#454 で認証ガードは
  // router.tsx の requireAuth が担い、/?login=1 のモーダルへ誘導する。router.test.tsx でカバー済み）。
  // ここでは AuthLayout が認証状態に依存せず Outlet をそのまま描画し、リダイレクトしないことを固定する。
  it("未認証（/auth/me 401）でも Outlet をそのまま描画し、リダイレクトしない", async () => {
    stubFetch(false);
    renderWithRouter(<div>子コンテンツ</div>);

    expect(await screen.findByText("子コンテンツ")).toBeInTheDocument();
  });

  // 受け入れ条件 #467-4 の翻訳: AuthLayout は自前ローディング UI を持たず純粋に Outlet を描画する。
  // 子が遅延（lazy + Suspense）する場合、解決前はフォールバック、解決後は子が描画される。
  it("子が遅延する場合は Suspense フォールバックを経て子が描画される", async () => {
    stubFetch(true);

    let resolveChild!: () => void;
    const childReady = new Promise<void>((resolve) => {
      resolveChild = resolve;
    });
    const LazyChild = lazy(async () => {
      await childReady;
      return { default: (): ReactElement => <div>遅延した子</div> };
    });

    renderWithRouter(
      <Suspense fallback={<div>読み込み中フォールバック</div>}>
        <LazyChild />
      </Suspense>,
    );

    // 解決前はフォールバックが見える。
    expect(await screen.findByText("読み込み中フォールバック")).toBeInTheDocument();

    // 子モジュールの解決後は子が描画される。
    resolveChild();
    expect(await screen.findByText("遅延した子")).toBeInTheDocument();
  });
});
