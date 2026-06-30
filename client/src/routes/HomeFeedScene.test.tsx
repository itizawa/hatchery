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
  communities?: Array<{ id: string; slug: string; name: string }>;
};

function stubFetch({ authenticated, feedPosts = [], communities = [] }: FetchStubOptions) {
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
    if (url.includes("/subscriptions/unread-counts")) {
      return Promise.resolve(
        new Response(JSON.stringify({ unread_counts: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    if (url.includes("/vote")) {
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
    if (/\/api\/communities$/.test(url)) {
      return Promise.resolve(
        new Response(JSON.stringify(communities), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
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
    expect((await screen.findAllByText("ゲスト閲覧テスト投稿"))[0]).toBeInTheDocument();
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

  it("投稿が 0 件のときはようこそセクションが表示される", async () => {
    stubFetch({ authenticated: false, feedPosts: [] });
    renderApp("/");

    expect(await screen.findByRole("heading", { name: /Hatchery へようこそ/ })).toBeInTheDocument();
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

    expect((await screen.findAllByText("テスト投稿"))[0]).toBeInTheDocument();
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
    expect((await screen.findAllByText("トレンド投稿テスト"))[0]).toBeInTheDocument();
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

    const [title] = await screen.findAllByText("スレッド遷移テスト投稿");
    const link = title.closest("a");
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute("href", `/posts/${post.id}`);
  });

  it("投稿カードのタイトルをクリックするとスレッド（/posts/$postId）へ遷移する", async () => {
    stubFetch({ authenticated: false, feedPosts: [post] });
    renderApp("/");

    const [title] = await screen.findAllByText("スレッド遷移テスト投稿");
    await userEvent.click(title);

    expect(
      await screen.findByText(/まだコメントはありません/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /ホームフィード/ })).not.toBeInTheDocument();
  });
});

describe("HomeFeedScene — 所属コミュニティ名表示（混在フィード・#503）", () => {
  const communities = [
    { id: "community-1", slug: "hatchery", name: "Hatchery メタ" },
    { id: "community-2", slug: "zenn", name: "Zenn感想部" },
  ];
  const mixedPosts = [
    {
      id: "post-1",
      community_id: "community-1",
      slot_key: "2026-06-10-morning",
      seq: 1,
      author: "worker-haru",
      title: "hatchery の投稿",
      text: "内容A",
      score: 0,
      created_at: "2026-06-10T00:00:00Z",
    },
    {
      id: "post-2",
      community_id: "community-2",
      slot_key: "2026-06-10-morning",
      seq: 2,
      author: "worker-ken",
      title: "zenn の投稿",
      text: "内容B",
      score: 0,
      created_at: "2026-06-10T01:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("異なる community の投稿が混在するフィードで各カードに c/{slug} が表示される", async () => {
    stubFetch({ authenticated: false, feedPosts: mixedPosts, communities });
    renderApp("/");

    expect((await screen.findAllByText("hatchery の投稿"))[0]).toBeInTheDocument();
    expect(await screen.findByText("c/hatchery")).toBeInTheDocument();
    expect(await screen.findByText("c/zenn")).toBeInTheDocument();
  });

  it("c/{slug} をクリックするとそのコミュニティページ（/communities/$slug）へ遷移する", async () => {
    stubFetch({ authenticated: false, feedPosts: mixedPosts, communities });
    renderApp("/");

    const communityLink = await screen.findByRole("button", { name: "c/zenn" });
    await userEvent.click(communityLink);

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: /ホームフィード/ })).not.toBeInTheDocument();
    });
  });
});

describe("HomeFeedScene — ゲストも vote できる (#777)", () => {
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

  it("未認証ユーザーが vote ボタンを押すと vote API が呼ばれる（ログイン誘導は不要・#777）", async () => {
    const fetchMock = stubFetch({ authenticated: false, feedPosts: [guestPost] });
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

    expect(screen.queryByText(/投票するにはログインが必要です/)).not.toBeInTheDocument();
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
  });
});

describe("HomeFeedScene — コメント Chip クリックでコメントセクションへ遷移（#836）", () => {
  const post = {
    id: "post-836",
    community_id: "community-1",
    slot_key: "2026-06-20-morning",
    seq: 1,
    author: "worker-haru",
    title: "コメント Chip テスト投稿",
    text: "内容",
    score: 0,
    comment_count: 5,
    created_at: "2026-06-20T00:00:00Z",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("コメント数 Chip をクリックすると /posts/$postId#comments へ遷移する", async () => {
    stubFetch({ authenticated: false, feedPosts: [post] });
    renderApp("/");

    const chip = await screen.findByLabelText("コメント 5 件");
    await userEvent.click(chip);

    expect(
      await screen.findByText(/まだコメントはありません/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /ホームフィード/ })).not.toBeInTheDocument();
  });
});

describe("HomeFeedScene — 各 PostCard に ShareButton が表示される (#838)", () => {
  const post = {
    id: "post-share-838",
    community_id: "community-1",
    slot_key: "2026-06-20-morning",
    seq: 1,
    author: "worker-haru",
    title: "ShareButton 表示テスト",
    text: "内容",
    score: 0,
    created_at: "2026-06-20T00:00:00Z",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("フィードの各 PostCard に共有ボタンが表示される", async () => {
    stubFetch({ authenticated: false, feedPosts: [post] });
    renderApp("/");

    expect((await screen.findAllByText("ShareButton 表示テスト"))[0]).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /共有/i })).toBeInTheDocument();
  });
});

describe("HomeFeedScene — ようこそ演出（#482）", () => {
  const sampleCommunities = [
    { id: "c-1", slug: "ai-dev", name: "AI 開発者の集い" },
    { id: "c-2", slug: "zenn-talk", name: "Zenn 感想部" },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("未認証 + 投稿なし → ようこそセクションが表示される", async () => {
    stubFetch({ authenticated: false, feedPosts: [], communities: sampleCommunities });
    renderApp("/");

    expect(await screen.findByRole("heading", { name: /Hatchery へようこそ/ })).toBeInTheDocument();
  });

  it("未認証 + 投稿なし → コミュニティ一覧と「コミュニティを探す」ボタンが表示される", async () => {
    stubFetch({ authenticated: false, feedPosts: [], communities: sampleCommunities });
    renderApp("/");

    const aiDevTexts = await screen.findAllByText("AI 開発者の集い");
    expect(aiDevTexts.length).toBeGreaterThan(0);
    expect(await screen.findByRole("link", { name: /コミュニティを探す/ })).toBeInTheDocument();
  });

  it("認証済み + 投稿なし → ようこそセクションが表示される", async () => {
    stubFetch({ authenticated: true, feedPosts: [], communities: sampleCommunities });
    renderApp("/");

    expect(await screen.findByRole("heading", { name: /Hatchery へようこそ/ })).toBeInTheDocument();
  });

  it("認証済みで投稿があるとき → ようこそセクションは表示されない", async () => {
    stubFetch({
      authenticated: true,
      feedPosts: [
        {
          id: "post-1",
          community_id: "c-1",
          slot_key: "2026-06-10-morning",
          seq: 1,
          author: "worker-haru",
          title: "既存投稿",
          text: "内容",
          score: 0,
          created_at: "2026-06-10T00:00:00Z",
        },
      ],
      communities: sampleCommunities,
    });
    renderApp("/");

    expect((await screen.findAllByText("既存投稿"))[0]).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Hatchery へようこそ/ })).not.toBeInTheDocument();
  });

  it("未認証で投稿がある場合でも → ようこそセクションが表示される", async () => {
    stubFetch({
      authenticated: false,
      feedPosts: [
        {
          id: "post-2",
          community_id: "c-1",
          slot_key: "2026-06-10-morning",
          seq: 1,
          author: "worker-haru",
          title: "ゲスト閲覧テスト投稿",
          text: "内容",
          score: 0,
          created_at: "2026-06-10T00:00:00Z",
        },
      ],
      communities: sampleCommunities,
    });
    renderApp("/");

    expect(await screen.findByRole("heading", { name: /Hatchery へようこそ/ })).toBeInTheDocument();
    expect((await screen.findAllByText("ゲスト閲覧テスト投稿"))[0]).toBeInTheDocument();
  });
});

describe("HomeFeedScene — IntersectionObserver 無限スクロール（sentinelRef）(#944)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const buildPost = ({ id, title }: { id: string; title: string }) => ({
    id,
    title,
    community_id: "community-1",
    slot_key: "2026-06-10-morning",
    seq: 1,
    author: "worker-haru",
    text: "内容",
    score: 0,
    created_at: "2026-06-10T00:00:00Z",
  });

  it("hasNextPage=true かつ番兵要素が intersect するとき fetchNextPage が呼ばれる（#944）", async () => {
    let observerCallback: ((entries: IntersectionObserverEntry[]) => void) | null = null;
    vi.stubGlobal(
      "IntersectionObserver",
      vi.fn((cb: (entries: IntersectionObserverEntry[]) => void) => {
        observerCallback = cb;
        return { observe: vi.fn(), disconnect: vi.fn() };
      }),
    );

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/auth/me")) return Promise.resolve(new Response(null, { status: 401 }));
      if (url.includes("/api/feed")) {
        const isNextPage = url.includes("cursor=");
        return Promise.resolve(
          new Response(
            JSON.stringify({
              posts: [buildPost({ id: isNextPage ? "post-2" : "post-1", title: isNextPage ? "2ページ目" : "1ページ目の投稿" })],
              nextCursor: isNextPage ? null : "cursor1",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    renderApp("/");
    await screen.findAllByText("1ページ目の投稿");
    expect(observerCallback).not.toBeNull();

    observerCallback!([{ isIntersecting: true } as IntersectionObserverEntry]);

    await waitFor(() => {
      const cursorCalls = fetchMock.mock.calls.filter((args: unknown[]) => {
        const url = args[0] instanceof Request ? args[0].url : String(args[0]);
        return url.includes("/api/feed") && url.includes("cursor=");
      });
      expect(cursorCalls.length).toBeGreaterThan(0);
    });
  });

  it("hasNextPage=false のとき番兵要素が intersect しても fetchNextPage が呼ばれない（#944）", async () => {
    let observerCallback: ((entries: IntersectionObserverEntry[]) => void) | null = null;
    vi.stubGlobal(
      "IntersectionObserver",
      vi.fn((cb: (entries: IntersectionObserverEntry[]) => void) => {
        observerCallback = cb;
        return { observe: vi.fn(), disconnect: vi.fn() };
      }),
    );

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/auth/me")) return Promise.resolve(new Response(null, { status: 401 }));
      if (url.includes("/api/feed")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ posts: [buildPost({ id: "post-1", title: "最終ページの投稿" })], nextCursor: null }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    renderApp("/");
    await screen.findAllByText("最終ページの投稿");

    const countBefore = fetchMock.mock.calls.filter((args: unknown[]) => {
      const url = args[0] instanceof Request ? args[0].url : String(args[0]);
      return url.includes("/api/feed") && url.includes("cursor=");
    }).length;

    observerCallback!([{ isIntersecting: true } as IntersectionObserverEntry]);

    // The callback checks hasNextPage synchronously; no timing delay needed.
    const countAfter = fetchMock.mock.calls.filter((args: unknown[]) => {
      const url = args[0] instanceof Request ? args[0].url : String(args[0]);
      return url.includes("/api/feed") && url.includes("cursor=");
    }).length;

    expect(countAfter).toBe(countBefore);
  });

  it("isFetchingNextPage=true のとき番兵要素が intersect しても重複 fetch しない（#944）", async () => {
    let observerCallback: ((entries: IntersectionObserverEntry[]) => void) | null = null;
    const MockIO = vi.fn((cb: (entries: IntersectionObserverEntry[]) => void) => {
      observerCallback = cb;
      return { observe: vi.fn(), disconnect: vi.fn() };
    });
    vi.stubGlobal("IntersectionObserver", MockIO);

    let resolveSecondPage: ((v: Response) => void) | null = null;
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/auth/me")) return Promise.resolve(new Response(null, { status: 401 }));
      if (url.includes("/api/feed")) {
        if (url.includes("cursor=")) {
          return new Promise<Response>((resolve) => {
            resolveSecondPage = resolve;
          });
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({ posts: [buildPost({ id: "post-1", title: "1ページ目" })], nextCursor: "cursor1" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    renderApp("/");
    await screen.findAllByText("1ページ目");
    const ioCallsBefore = MockIO.mock.calls.length;

    // 1回目の intersect → fetchNextPage 開始（isFetchingNextPage=true）
    observerCallback!([{ isIntersecting: true } as IntersectionObserverEntry]);

    // Wait until the cursor fetch has started AND a new IO has been created.
    // Checking both together ensures observerCallback captures isFetchingNextPage=true,
    // guarding against an intermediate re-render that could install a stale closure.
    await waitFor(() => {
      const started = fetchMock.mock.calls.filter((args: unknown[]) => {
        const url = args[0] instanceof Request ? args[0].url : String(args[0]);
        return url.includes("/api/feed") && url.includes("cursor=");
      });
      expect(started.length).toBeGreaterThan(0);
      expect(MockIO.mock.calls.length).toBeGreaterThan(ioCallsBefore);
    });

    // 新しいコールバック（isFetchingNextPage=true を閉じ込めている）で再 intersect → 無視される
    observerCallback!([{ isIntersecting: true } as IntersectionObserverEntry]);

    // 2ページ目を resolve
    resolveSecondPage!(
      new Response(
        JSON.stringify({ posts: [buildPost({ id: "post-2", title: "2ページ目" })], nextCursor: null }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await screen.findAllByText("2ページ目");

    // cursor=... のフェッチは 1 回のみ
    const cursorCalls = fetchMock.mock.calls.filter((args: unknown[]) => {
      const url = args[0] instanceof Request ? args[0].url : String(args[0]);
      return url.includes("/api/feed") && url.includes("cursor=");
    });
    expect(cursorCalls.length).toBe(1);
  });
});

describe("HomeFeedScene — ゲスト初回/再訪問でのようこそ演出切り替え（#932）", () => {
  const post = {
    id: "post-1",
    community_id: "c-1",
    slot_key: "2026-06-10-morning",
    seq: 1,
    author: "worker-haru",
    title: "再訪テスト投稿",
    text: "内容",
    score: 0,
    created_at: "2026-06-10T00:00:00Z",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("初回訪問ゲスト（hatchery_visited なし）は投稿があっても WelcomeSection が表示される", async () => {
    stubFetch({ authenticated: false, feedPosts: [post] });
    renderApp("/");

    expect(await screen.findByRole("heading", { name: /Hatchery へようこそ/ })).toBeInTheDocument();
    expect((await screen.findAllByText("再訪テスト投稿"))[0]).toBeInTheDocument();
  });

  it("再訪問ゲスト（hatchery_visited=true）は投稿がある場合 WelcomeSection が表示されない", async () => {
    localStorage.setItem("hatchery_visited", "true");
    stubFetch({ authenticated: false, feedPosts: [post] });
    renderApp("/");

    expect((await screen.findAllByText("再訪テスト投稿"))[0]).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Hatchery へようこそ/ })).not.toBeInTheDocument();
  });

  it("再訪問ゲスト（hatchery_visited=true）でも投稿が 0 件のときは WelcomeSection が表示される", async () => {
    localStorage.setItem("hatchery_visited", "true");
    stubFetch({ authenticated: false, feedPosts: [] });
    renderApp("/");

    expect(await screen.findByRole("heading", { name: /Hatchery へようこそ/ })).toBeInTheDocument();
  });

  it("WelcomeSection が表示されたとき localStorage に hatchery_visited が保存される", async () => {
    expect(localStorage.getItem("hatchery_visited")).toBeNull();
    stubFetch({ authenticated: false, feedPosts: [post] });
    renderApp("/");

    expect(await screen.findByRole("heading", { name: /Hatchery へようこそ/ })).toBeInTheDocument();
    expect(localStorage.getItem("hatchery_visited")).toBe("true");
  });
});
