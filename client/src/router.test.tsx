import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAppRouter, type AppRouter } from "./router";

/** サイドバー（ChannelList）が呼ぶ GET /channels を既定チャンネルで応答する fetch スタブ。 */
function stubChannelsFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          { id: "zatsudan", label: "#雑談" },
          { id: "shigoto", label: "#仕事" },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ),
  );
}

/** ルータを QueryClientProvider 下で描画する（ChannelList が TanStack Query を使うため・#47）。 */
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

// 受け入れ条件 #4: コードベース定義の最小ルート。ホーム（/）でタイムライン表示の枠が描画される。
describe("createAppRouter", () => {
  beforeEach(() => {
    stubChannelsFetch();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ホームルート（/）でタイムライン表示の枠の見出しを描画する", async () => {
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    render(renderRouter(router));
    expect(await screen.findByRole("heading", { name: /タイムライン/ })).toBeInTheDocument();
  });

  it("サイドバーにチャンネル一覧（#雑談）を描画する", async () => {
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    render(renderRouter(router));
    expect(await screen.findByText("#雑談")).toBeInTheDocument();
  });

  it("チャンネルルート（/channels/$channelId）で選択中チャンネルの詳細（ヘッダ）を描画する", async () => {
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: ["/channels/zatsudan"] }),
    });
    render(renderRouter(router));
    // ChannelView のヘッダ（見出し）として channel.label を描画する（サイドバーの一覧は heading ではない）。
    expect(await screen.findByRole("heading", { name: "#雑談" })).toBeInTheDocument();
  });
});
