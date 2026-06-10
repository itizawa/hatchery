import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "../queryClient.js";
import { createAppRouter } from "../router.js";

type FetchStubOptions = {
  authenticated: boolean;
  feedPosts?: Array<{
    id: string;
    community_id: string;
    slot_key: string;
    seq: number;
    author: string;
    title: string;
    text: string;
    score: number;
    created_at: string;
  }>;
};

function stubFetch({ authenticated, feedPosts = [] }: FetchStubOptions) {
  const user = authenticated
    ? { id: "user1", displayName: "Alice", role: "member", loginId: "alice" }
    : undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/auth/me")) {
        return Promise.resolve(
          new Response(authenticated ? JSON.stringify(user) : null, {
            status: authenticated ? 200 : 401,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      if (url.includes("/api/feed")) {
        return Promise.resolve(
          new Response(JSON.stringify(feedPosts), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }),
  );
}

function renderApp(initialPath: string) {
  const queryClient = createQueryClient();
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("HomeFeedScene — 未認証ユーザー (#341)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("未認証ユーザーが / にアクセスするとゲスト向け誘導 UI が表示される（ログインへのリダイレクトなし）", async () => {
    stubFetch({ authenticated: false });
    renderApp("/");

    expect(await screen.findByRole("heading", { name: /ホームフィード/ })).toBeInTheDocument();
    // ゲスト向けのログインボタン（Button）が表示される
    const loginLinks = await screen.findAllByRole("link", { name: /ログイン/ });
    expect(loginLinks.length).toBeGreaterThan(0);
  });

  it("未認証時に GET /api/feed が呼ばれない", async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/auth/me")) {
        return Promise.resolve(new Response(null, { status: 401 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    renderApp("/");

    // ゲスト UI が表示されるまで待つ
    expect(await screen.findByRole("heading", { name: /ホームフィード/ })).toBeInTheDocument();

    await waitFor(() => {
      const feedCalls = fetchMock.mock.calls.filter((args: unknown[]) => {
        const url = args[0] instanceof Request ? args[0].url : String(args[0]);
        return url.includes("/api/feed");
      });
      expect(feedCalls).toHaveLength(0);
    });
  });
});

describe("HomeFeedScene — 認証済みユーザー (#341)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("認証済みで購読投稿なしの場合は「購読なし」誘導 UI が表示される", async () => {
    stubFetch({ authenticated: true, feedPosts: [] });
    renderApp("/");

    expect(
      await screen.findByText(/購読中のコミュニティに投稿がありません/),
    ).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /コミュニティを探す/ })).toBeInTheDocument();
  });

  it("認証済みで投稿がある場合はフィードが表示される", async () => {
    stubFetch({
      authenticated: true,
      feedPosts: [
        {
          id: "post-1",
          community_id: "community-1",
          slot_key: "2026-06-10-morning",
          seq: 1,
          author: "worker-haru",
          title: "テスト投稿",
          text: "テスト内容",
          score: 5,
          created_at: "2026-06-10T00:00:00Z",
        },
      ],
    });
    renderApp("/");

    expect(await screen.findByText("テスト投稿")).toBeInTheDocument();
  });
});
