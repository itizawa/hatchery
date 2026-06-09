import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAppRouter, type AppRouter } from "./router";

const COMMUNITIES_DATA = [
  { id: "community-1", slug: "ai-dev", name: "AI 開発者の集い", description: "AI の話", created_at: "2026-06-01T00:00:00Z" },
];

/** ログイン済みを表す /auth/me のレスポンスボディ（AuthUser）。 */
const AUTH_USER = {
  id: "testuser",
  displayName: "Test User",
  role: "admin",
  employeeId: "emp-testuser",
};

/**
 * サイドバー・各 Scene が呼ぶ fetch を応答する。
 * authenticated=true なら /auth/me → 200 AUTH_USER、false なら 401。
 */
function stubFetch({ authenticated }: { authenticated: boolean }) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: string | URL | Request) => {
      const urlStr = input instanceof Request ? input.url : String(input);
      if (urlStr.includes("/auth/me")) {
        return authenticated
          ? Promise.resolve(
              new Response(JSON.stringify(AUTH_USER), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              }),
            )
          : Promise.resolve(new Response(null, { status: 401 }));
      }
      if (urlStr.includes("/api/communities") && !urlStr.includes("/feed") && !urlStr.includes("/subscribe")) {
        return Promise.resolve(
          new Response(JSON.stringify(COMMUNITIES_DATA), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      if (urlStr.includes("/api/feed")) {
        return Promise.resolve(
          new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }),
        );
      }
      // posts, comments, etc.
      return Promise.resolve(
        new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }),
      );
    }),
  );
}

/** ルータを QueryClientProvider 下で描画する（各シーンが TanStack Query を使うため）。 */
function renderRouter(router: AppRouter): ReactElement {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

describe("AuthLayout（ログインページ専用レイアウト）", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("/login ではサイドバーが表示されない", async () => {
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: ["/login"] }),
    });
    render(renderRouter(router));
    expect(await screen.findByRole("heading", { name: /ログイン/ })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /サイドバー/ })).not.toBeInTheDocument();
  });
});

// 受け入れ条件 #307: コードベース定義のルート確認。
describe("createAppRouter", () => {
  beforeEach(() => {
    stubFetch({ authenticated: true });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ホームルート（/）でホームフィードの見出しを描画する", async () => {
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    render(renderRouter(router));
    expect(await screen.findByRole("heading", { name: /ホームフィード/ })).toBeInTheDocument();
  });

  it("サイドバーにコミュニティセクションが表示される", async () => {
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    render(renderRouter(router));
    expect(await screen.findByText("コミュニティ")).toBeInTheDocument();
  });

  it("コミュニティブラウズルート（/communities）でコミュニティ探す見出しを描画する", async () => {
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: ["/communities"] }),
    });
    render(renderRouter(router));
    expect(await screen.findByRole("heading", { name: /コミュニティを探す/ })).toBeInTheDocument();
  });

  // Issue #236: 動的 import（lazyRouteComponent）後もルートが正しく描画されることを担保する。
  it("アカウントルート（/account）でアカウント設定画面を描画する", async () => {
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: ["/account"] }),
    });
    render(renderRouter(router));
    expect(await screen.findByRole("heading", { name: /アカウント設定/ })).toBeInTheDocument();
  });

  it("管理ルート（/admin）で管理画面を描画する", async () => {
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: ["/admin"] }),
    });
    render(renderRouter(router));
    expect(await screen.findByRole("heading", { name: /管理画面/ })).toBeInTheDocument();
  });
});

// 認証ガード: 未ログインで保護ルートを開くと /login へリダイレクトする。
describe("認証ガード（未ログイン時のリダイレクト）", () => {
  beforeEach(() => {
    stubFetch({ authenticated: false });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("未ログインでホーム（/）を開くと /login へリダイレクトする", async () => {
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    render(renderRouter(router));
    expect(await screen.findByRole("heading", { name: /ログイン/ })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /サイドバー/ })).not.toBeInTheDocument();
  });

  // Issue #236: 動的 import 後も認証ガードが正しく機能することを担保する。
  it("未ログインでアカウント（/account）を開くと /login へリダイレクトする", async () => {
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: ["/account"] }),
    });
    render(renderRouter(router));
    expect(await screen.findByRole("heading", { name: /ログイン/ })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /サイドバー/ })).not.toBeInTheDocument();
  });

  it("未ログインで管理画面（/admin）を開くと /login へリダイレクトする", async () => {
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: ["/admin"] }),
    });
    render(renderRouter(router));
    expect(await screen.findByRole("heading", { name: /ログイン/ })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /サイドバー/ })).not.toBeInTheDocument();
  });

  // コミュニティブラウズは認証不要（公開ページ）
  it("未認証でコミュニティブラウズ（/communities）を開いても /login へリダイレクトしない", async () => {
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: ["/communities"] }),
    });
    render(renderRouter(router));
    expect(await screen.findByRole("heading", { name: /コミュニティを探す/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /ログイン/ })).not.toBeInTheDocument();
  });
});
