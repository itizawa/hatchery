import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAppRouter, type AppRouter } from "./router";

const CHANNELS_DATA = [
  { id: "zatsudan", label: "雑談", type: "zatsudan" },
  { id: "shigoto", label: "仕事", type: "task" },
];

/** ログイン済みを表す /auth/me のレスポンスボディ（AuthUser）。 */
const AUTH_USER = {
  id: "testuser",
  displayName: "Test User",
  role: "admin",
  employeeId: "emp-testuser",
};

/** サイドバー（ChannelList）・ChannelScene が呼ぶ fetch を応答する。
 * mockImplementation で毎回新しい Response を生成する（useSuspenseQuery は複数回 fetch するため）。
 * authenticated=true なら /auth/me → 200 AUTH_USER、false なら 401。/messages → []、その他 → CHANNELS_DATA */
function stubChannelsFetch({ authenticated }: { authenticated: boolean }) {
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
      const body = urlStr.includes("/messages") ? JSON.stringify([]) : JSON.stringify(CHANNELS_DATA);
      return Promise.resolve(
        new Response(body, { status: 200, headers: { "Content-Type": "application/json" } }),
      );
    }),
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
    stubChannelsFetch({ authenticated: true });
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

  it("サイドバーにチャンネル一覧（雑談）を描画する", async () => {
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    render(renderRouter(router));
    // 「雑談」は AddChannelForm のタイプ選択ラジオにも現れるため、サイドバーのチャンネル一覧内にスコープして確認する。
    const channelList = await screen.findByRole("list", { name: "チャンネル一覧" });
    expect(within(channelList).getByText("雑談")).toBeInTheDocument();
  });

  it("チャンネルルート（/channels/$channelId）で選択中チャンネルの詳細（ヘッダ）を描画する", async () => {
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: ["/channels/zatsudan"] }),
    });
    render(renderRouter(router));
    // ChannelView のヘッダ（見出し）として channel.label を描画する（サイドバーの一覧は heading ではない）。
    expect(await screen.findByRole("heading", { name: "雑談" })).toBeInTheDocument();
  });
});

// 認証ガード: 未ログインで保護ルートを開くと /login へリダイレクトする。
describe("認証ガード（未ログイン時のリダイレクト）", () => {
  beforeEach(() => {
    stubChannelsFetch({ authenticated: false });
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

  it("未ログインでチャンネル（/channels/$channelId）を開くと /login へリダイレクトする", async () => {
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: ["/channels/zatsudan"] }),
    });
    render(renderRouter(router));
    expect(await screen.findByRole("heading", { name: /ログイン/ })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /サイドバー/ })).not.toBeInTheDocument();
  });
});
