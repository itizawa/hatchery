import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    ? { id: "user1", displayName: "Alice", role: "member", email: "alice@example.com" }
    : undefined;
  const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes("/auth/me")) {
      return Promise.resolve(
        new Response(authenticated ? JSON.stringify(user) : null, {
          status: authenticated ? 200 : 401,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    if (url.includes("/vote")) {
      // vote API は authenticated のみ成功する想定。返り値は更新後の Post。
      const voted = feedPosts[0]
        ? { ...feedPosts[0], score: feedPosts[0].score + 1 }
        : { id: "post-1", score: 1 };
      return Promise.resolve(
        new Response(JSON.stringify(voted), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    if (url.includes("/api/feed")) {
      return Promise.resolve(
        new Response(JSON.stringify({ posts: feedPosts, nextCursor: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    // #498: スレッド遷移テスト用。GET /api/posts/{postId} を post + comments で返す。
    if (/\/api\/posts\/[^/]+$/.test(url)) {
      const post = feedPosts[0] ?? { id: "post-1", title: "投稿", text: "", score: 0 };
      return Promise.resolve(
        new Response(JSON.stringify({ post, comments: [] }), {
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
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
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

describe("HomeFeedScene — 未認証ユーザー (#347)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("未認証ユーザーが / にアクセスするとホームフィードが表示される（ゲスト誘導 UI ではなく投稿一覧）", async () => {
    stubFetch({
      authenticated: false,
      feedPosts: [
        {
          id: "post-1",
          community_id: "community-1",
          slot_key: "2026-06-10-morning",
          seq: 1,
          author: "worker-haru",
          title: "ゲスト閲覧テスト投稿",
          text: "内容",
          score: 0,
          created_at: "2026-06-10T00:00:00Z",
        },
      ],
    });
    renderApp("/");

    expect(await screen.findByRole("heading", { name: /ホームフィード/ })).toBeInTheDocument();
    expect(await screen.findByText("ゲスト閲覧テスト投稿")).toBeInTheDocument();
  });

  it("未認証時でも GET /api/feed が呼ばれる", async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/auth/me")) {
        return Promise.resolve(new Response(null, { status: 401 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ posts: [], nextCursor: null }), { status: 200, headers: { "Content-Type": "application/json" } }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    renderApp("/");

    await waitFor(() => {
      const feedCalls = fetchMock.mock.calls.filter((args: unknown[]) => {
        const url = args[0] instanceof Request ? args[0].url : String(args[0]);
        return url.includes("/api/feed");
      });
      expect(feedCalls.length).toBeGreaterThan(0);
    });
  });
});

describe("HomeFeedScene — フィード表示 (#347)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("投稿が 0 件のときは「まだ投稿がありません」が表示される", async () => {
    stubFetch({ authenticated: false, feedPosts: [] });
    renderApp("/");

    expect(await screen.findByText(/まだ投稿がありません/)).toBeInTheDocument();
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

describe("HomeFeedScene — 人気フィード (/popular) (#435)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("/popular で人気フィードの見出しと投稿が表示される", async () => {
    stubFetch({
      authenticated: false,
      feedPosts: [
        {
          id: "post-1",
          community_id: "community-1",
          slot_key: "2026-06-10-morning",
          seq: 1,
          author: "worker-haru",
          title: "トレンド投稿テスト",
          text: "内容",
          score: 99,
          created_at: "2026-06-10T00:00:00Z",
        },
      ],
    });
    renderApp("/popular");

    expect(await screen.findByRole("heading", { name: "人気の投稿" })).toBeInTheDocument();
    expect(await screen.findByText("トレンド投稿テスト")).toBeInTheDocument();
  });

  it("/popular では GET /api/feed?sort=popular が呼ばれる", async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/auth/me")) {
        return Promise.resolve(new Response(null, { status: 401 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ posts: [], nextCursor: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    renderApp("/popular");

    await waitFor(() => {
      const popularCalls = fetchMock.mock.calls.filter((args: unknown[]) => {
        const url = args[0] instanceof Request ? args[0].url : String(args[0]);
        return url.includes("/api/feed") && url.includes("sort=popular");
      });
      expect(popularCalls.length).toBeGreaterThan(0);
    });
  });
});

describe("HomeFeedScene — 投稿カードからスレッドへ遷移 (#498)", () => {
  const post = {
    id: "post-thread-1",
    community_id: "community-1",
    slot_key: "2026-06-10-morning",
    seq: 1,
    author: "worker-haru",
    title: "スレッド遷移テスト投稿",
    text: "内容",
    score: 0,
    created_at: "2026-06-10T00:00:00Z",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("投稿カードが /posts/$postId への href を持つリンクで囲まれている", async () => {
    stubFetch({ authenticated: false, feedPosts: [post] });
    renderApp("/");

    const title = await screen.findByText("スレッド遷移テスト投稿");
    const link = title.closest("a");
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute("href", `/posts/${post.id}`);
  });

  it("投稿カードのタイトルをクリックするとスレッド（/posts/$postId）へ遷移する", async () => {
    stubFetch({ authenticated: false, feedPosts: [post] });
    renderApp("/");

    const title = await screen.findByText("スレッド遷移テスト投稿");
    await userEvent.click(title);

    // スレッド（/posts/$postId）へ遷移し、スレッド固有のコメント空状態が表示される。
    expect(
      await screen.findByText(/まだコメントはありません/),
    ).toBeInTheDocument();
    // フィードの見出しは消えている（ページが切り替わった）。
    expect(screen.queryByRole("heading", { name: /ホームフィード/ })).not.toBeInTheDocument();
  });
});

describe("HomeFeedScene — ゲストの vote 押下でログイン誘導 (#481)", () => {
  const guestPost = {
    id: "post-1",
    community_id: "community-1",
    slot_key: "2026-06-10-morning",
    seq: 1,
    author: "worker-haru",
    title: "ゲスト vote テスト投稿",
    text: "内容",
    score: 3,
    created_at: "2026-06-10T00:00:00Z",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("未認証ユーザーが vote ボタンを押すとログイン誘導が表示され、vote API は呼ばれない", async () => {
    const fetchMock = stubFetch({ authenticated: false, feedPosts: [guestPost] });
    renderApp("/");

    const upVote = await screen.findByRole("button", { name: /up vote/i });
    await userEvent.click(upVote);

    // ログイン誘導（スナックバー）が表示される。
    expect(await screen.findByText(/投票するにはログインが必要です/)).toBeInTheDocument();

    // vote API（/vote）は一度も呼ばれない（サイレント 401 を出さない）。
    const voteCalls = fetchMock.mock.calls.filter((args: unknown[]) => {
      const url = args[0] instanceof Request ? args[0].url : String(args[0]);
      return url.includes("/vote");
    });
    expect(voteCalls.length).toBe(0);
  });

  it("認証済みユーザーが vote ボタンを押すと vote API が呼ばれる（回帰）", async () => {
    const fetchMock = stubFetch({ authenticated: true, feedPosts: [guestPost] });
    renderApp("/");

    const upVote = await screen.findByRole("button", { name: /up vote/i });
    await userEvent.click(upVote);

    await waitFor(() => {
      const voteCalls = fetchMock.mock.calls.filter((args: unknown[]) => {
        const url = args[0] instanceof Request ? args[0].url : String(args[0]);
        return url.includes("/vote");
      });
      expect(voteCalls.length).toBeGreaterThan(0);
    });

    // 認証済みではログイン誘導は表示されない。
    expect(screen.queryByText(/投票するにはログインが必要です/)).not.toBeInTheDocument();
  });
});
