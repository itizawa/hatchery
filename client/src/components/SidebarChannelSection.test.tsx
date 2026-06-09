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

import { SidebarChannelSection } from "./SidebarChannelSection";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubFetch(meStatus: number, meBody: unknown, channels: unknown[] = []) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/auth/me")) {
        return Promise.resolve(jsonResponse(meStatus, meBody));
      }
      if (url.includes("/channels")) {
        return Promise.resolve(jsonResponse(200, channels));
      }
      return Promise.resolve(jsonResponse(201, {}));
    }),
  );
}

function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

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
    component: () => ui,
  });

  const channelRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/channels/$channelId",
    component: () => null,
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, channelRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });

  return render(<RouterProvider router={router} />);
}

// 受け入れ条件 #233: サイドバーチャンネルセクションの動作
describe("SidebarChannelSection（#233）", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("「チャンネル」セクションヘッダーが表示される", async () => {
    stubFetch(200, { id: "u1", displayName: "Alice" });
    renderWithProviders(<SidebarChannelSection />);
    expect(await screen.findByText("チャンネル")).toBeInTheDocument();
  });

  it("ログイン時はプラスアイコンボタンが表示される", async () => {
    stubFetch(200, { id: "u1", displayName: "Alice" });
    renderWithProviders(<SidebarChannelSection />);
    expect(await screen.findByRole("button", { name: "チャンネルを追加" })).toBeInTheDocument();
  });

  it("未ログイン時はプラスアイコンボタンが表示されない", async () => {
    stubFetch(401, { error: "Unauthorized" });
    renderWithProviders(<SidebarChannelSection />);
    // 認証状態が解決されるまで待つ（チャンネル一覧が読み込まれる）
    await screen.findByText("チャンネル");
    expect(screen.queryByRole("button", { name: "チャンネルを追加" })).not.toBeInTheDocument();
  });

  it("プラスアイコンをクリックするとチャンネル作成ダイアログが開く", async () => {
    stubFetch(200, { id: "u1", displayName: "Alice" });
    renderWithProviders(<SidebarChannelSection />);
    const addButton = await screen.findByRole("button", { name: "チャンネルを追加" });
    await userEvent.click(addButton);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("チャンネルを追加")).toBeInTheDocument();
  });

  it("チャンネル一覧を表示する", async () => {
    stubFetch(200, { id: "u1", displayName: "Alice" }, [
      { id: "ch1", label: "雑談", type: "zatsudan" },
    ]);
    renderWithProviders(<SidebarChannelSection />);
    expect(await screen.findByText("雑談")).toBeInTheDocument();
  });
});

// 受け入れ条件 #277: モバイル時 Tooltip 非表示、デスクトップ時 Tooltip 表示
describe("SidebarChannelSection - Tooltip モバイル制御 (#277)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("モバイル幅（md 未満）", () => {
    beforeEach(() => {
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

    it("ログイン時でもツールチップが DOM に存在しない", async () => {
      stubFetch(200, { id: "u1", displayName: "Alice" });
      renderWithProviders(<SidebarChannelSection />);
      await screen.findByRole("button", { name: "チャンネルを追加" });
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });

    it("IconButton 自体は引き続き表示・機能する", async () => {
      stubFetch(200, { id: "u1", displayName: "Alice" });
      renderWithProviders(<SidebarChannelSection />);
      expect(await screen.findByRole("button", { name: "チャンネルを追加" })).toBeInTheDocument();
    });
  });

  describe("デスクトップ幅（md 以上）", () => {
    beforeEach(() => {
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

    it("ログイン時はボタンにホバーするとツールチップが表示される", async () => {
      stubFetch(200, { id: "u1", displayName: "Alice" });
      renderWithProviders(<SidebarChannelSection />);
      const addButton = await screen.findByRole("button", { name: "チャンネルを追加" });
      await userEvent.hover(addButton);
      expect(await screen.findByRole("tooltip", { name: "チャンネルを追加" })).toBeInTheDocument();
    });
  });
});
