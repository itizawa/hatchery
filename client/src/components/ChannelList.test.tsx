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
import { Suspense, type ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChannelList } from "./ChannelList";

/** JSON ボディを持つ Response を組み立てる小ヘルパ。 */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * retry を無効化した QueryClient・Suspense・RouterProvider で children を包む。
 * ChannelList が RouterLink を使うため RouterProvider が必要（#182）。
 */
function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<div>Loading...</div>}>{ui}</Suspense>
      </QueryClientProvider>
    ),
  });
  const channelRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/channels/$channelId",
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([channelRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });

  return render(<RouterProvider router={router} />);
}

/**
 * TanStack Router コンテキストを持つ最小ルータで ui を描画する。
 * Link の href 解決に必要な /channels/$channelId ルートを含む。
 */
function renderWithRouter(ui: ReactElement) {
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

// 受け入れ条件 AC6: ChannelList は GET /channels の結果を描画し、DEFAULT_CHANNELS を直接参照しない。
describe("ChannelList（GET /channels 駆動・#47）", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("GET /channels から返ったチャンネルのラベルを描画する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, [
          { id: "zatsudan", label: "雑談", type: "zatsudan" },
          { id: "shigoto", label: "仕事", type: "task" },
        ]),
      ),
    );

    renderWithClient(<ChannelList />);

    expect(await screen.findByText("雑談")).toBeInTheDocument();
    expect(await screen.findByText("仕事")).toBeInTheDocument();
  });

  it("API が返したチャンネルだけを描画する（ハードコードに依存しない）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, [{ id: "kikaku", label: "企画", type: "zatsudan" }]),
      ),
    );

    renderWithClient(<ChannelList />);

    expect(await screen.findByText("企画")).toBeInTheDocument();
    expect(screen.queryByText("雑談")).not.toBeInTheDocument();
  });

  it("zatsudan タイプのチャンネルにはタグアイコンが表示される（#54）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, [{ id: "zatsudan", label: "雑談", type: "zatsudan" }]),
      ),
    );

    renderWithClient(<ChannelList />);

    await screen.findByText("雑談");
    expect(screen.getByTestId("channel-type-icon-zatsudan")).toBeInTheDocument();
  });

  it("task タイプのチャンネルにはチェックリストアイコンが表示される（#54）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, [{ id: "shigoto", label: "仕事", type: "task" }]),
      ),
    );

    renderWithClient(<ChannelList />);

    await screen.findByText("仕事");
    expect(screen.getByTestId("channel-type-icon-task")).toBeInTheDocument();
  });
});

// 受け入れ条件 #182: チャンネル項目をクリックで /channels/$channelId へ遷移する動線
describe("ChannelList のナビゲーション（#182）", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("各チャンネル項目が対応する /channels/:id へのリンクになっている", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, [
          { id: "zatsudan", label: "雑談", type: "zatsudan" },
          { id: "shigoto", label: "仕事", type: "task" },
        ]),
      ),
    );

    renderWithRouter(<ChannelList />);

    const zatsudanLink = await screen.findByRole("link", { name: /雑談/ });
    expect(zatsudanLink).toHaveAttribute("href", "/channels/zatsudan");

    const shigotoLink = screen.getByRole("link", { name: /仕事/ });
    expect(shigotoLink).toHaveAttribute("href", "/channels/shigoto");
  });
});
