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

// 受け入れ条件 #206: 3点メニューによる編集導線
describe("ChannelList の編集メニュー（#206）", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(meStatus: number, meBody: unknown) {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: Request | string) => {
        const url = typeof input === "string" ? input : input.url;
        if (url.includes("/auth/me")) {
          return Promise.resolve(jsonResponse(meStatus, meBody));
        }
        if (url.includes("/channels/zatsudan") && (input as Request).method === "PATCH") {
          return Promise.resolve(jsonResponse(200, { id: "zatsudan", label: "新しい名前", type: "zatsudan" }));
        }
        return Promise.resolve(
          jsonResponse(200, [{ id: "zatsudan", label: "雑談", type: "zatsudan" }]),
        );
      }),
    );
  }

  it("未ログイン時はチャンネルの3点メニューボタンが表示されない（AC-f）", async () => {
    stubFetch(401, { error: "Unauthorized" });
    renderWithClient(<ChannelList />);
    await screen.findByText("雑談");
    expect(screen.queryByRole("button", { name: /雑談のメニュー/ })).not.toBeInTheDocument();
  });

  it("ログイン時はチャンネル行に3点メニューボタンが表示される（AC-e）", async () => {
    stubFetch(200, { id: "u1", displayName: "Alice" });
    renderWithClient(<ChannelList />);
    expect(await screen.findByRole("button", { name: "雑談のメニューを開く" })).toBeInTheDocument();
  });

  it("3点ボタンをクリックすると「名前を編集」メニュー項目が表示される（AC-e）", async () => {
    stubFetch(200, { id: "u1", displayName: "Alice" });
    renderWithClient(<ChannelList />);
    await userEvent.click(await screen.findByRole("button", { name: "雑談のメニューを開く" }));
    expect(await screen.findByRole("menuitem", { name: "名前を編集" })).toBeInTheDocument();
  });

  it("「名前を編集」をクリックするとチャンネル名編集ダイアログが開く（AC-e）", async () => {
    stubFetch(200, { id: "u1", displayName: "Alice" });
    renderWithClient(<ChannelList />);
    await userEvent.click(await screen.findByRole("button", { name: "雑談のメニューを開く" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "名前を編集" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "チャンネル名" })).toHaveValue("雑談");
  });
});

// 受け入れ条件 #277: モバイル時 3 点メニュー非表示、デスクトップ時表示
describe("ChannelList - 3 点メニューのモバイル制御 (#277)", () => {
  function stubFetchWithUser(meStatus: number, meBody: unknown) {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: Request | string) => {
        const url = typeof input === "string" ? input : input.url;
        if (url.includes("/auth/me")) {
          return Promise.resolve(
            new Response(JSON.stringify(meBody), {
              status: meStatus,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify([{ id: "zatsudan", label: "雑談", type: "zatsudan" }]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }),
    );
  }

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

    it("ログイン時でも 3 点メニューボタンが表示されない", async () => {
      stubFetchWithUser(200, { id: "u1", displayName: "Alice" });
      renderWithClient(<ChannelList />);
      await screen.findByText("雑談");
      expect(screen.queryByRole("button", { name: /雑談のメニュー/ })).not.toBeInTheDocument();
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

    it("ログイン時は 3 点メニューボタンが表示される", async () => {
      stubFetchWithUser(200, { id: "u1", displayName: "Alice" });
      renderWithClient(<ChannelList />);
      expect(await screen.findByRole("button", { name: "雑談のメニューを開く" })).toBeInTheDocument();
    });
  });
});
