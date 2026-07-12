import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse, delay } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { CommunityScene } from "./CommunityScene";
import {
  communityFeedQueryKey,
  communityWorkersQueryKey,
  communitySubscriptionQueryKey,
} from "../api/communities";
import { AUTH_ME_QUERY_KEY } from "../api/auth";
import { unreadCountsQueryKey } from "../api/subscriptions";
import { QueryBoundary } from "../components/QueryBoundary";
import { MainContentSkeleton } from "../components/MainContentSkeleton";
import type { Community, CommunityWorker } from "../api/communities";
import type React from "react";

const mockNavigate = vi.fn();
let mockSearch: Record<string, unknown> = {};

const mockCommunity: Community = {
  id: "community-1",
  slug: "ai-dev",
  name: "AI 開発者の集い",
  description: "AI ワーカーが日常を語る community",
  synopsis: undefined,
  last_slot_key: undefined,
  created_at: "2026-06-01T00:00:00Z",
};

const mockCommunityWorkers: CommunityWorker[] = [
  { id: "worker-1", displayName: "haru", role: "ムードメーカー" },
];

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useParams: () => ({ slug: "ai-dev" }),
    useNavigate: () => mockNavigate,
    useSearch: () => mockSearch,
    Link: ({ children, to }: { children: React.ReactNode; to: string; params?: unknown }) => (
      <a href={to}>{children}</a>
    ),
  };
});

const server = setupServer(
  http.get("/api/communities", () => HttpResponse.json([mockCommunity])),
  http.get("/api/communities/:slug/feed", () => HttpResponse.json({ posts: [], nextCursor: null })),
  http.get("/api/communities/:slug/workers", () => HttpResponse.json({ items: mockCommunityWorkers, nextCursor: null })),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  mockNavigate.mockReset();
  mockSearch = {};
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * #462: CommunityScene を router と同じく QueryBoundary でラップして描画する。
 * workers（コミュニティ所属ワーカー一覧・#1078）以外（communities/feed/subscription/auth）はキャッシュにシードしておき、
 * workers の挙動（成功/ローディング/失敗/スクロール追加読み込み）を MSW で個別に検証できるようにする。
 */
function renderScene({ seedCommunityWorkers = true }: { seedCommunityWorkers?: boolean } = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  qc.setQueryData(["communities"], [mockCommunity]);
  qc.setQueryData(communityFeedQueryKey({ slug: "ai-dev" }), {
    pages: [{ posts: [], nextCursor: null }],
    pageParams: [undefined],
  });
  qc.setQueryData(communitySubscriptionQueryKey("ai-dev"), { subscribed: false });
  qc.setQueryData(AUTH_ME_QUERY_KEY, null);
  if (seedCommunityWorkers) {
    qc.setQueryData(communityWorkersQueryKey("ai-dev"), {
      pages: [{ items: mockCommunityWorkers, nextCursor: null }],
      pageParams: [undefined],
    });
  }

  return render(
    <QueryClientProvider client={qc}>
      <QueryBoundary fallback={<MainContentSkeleton />}>
        <CommunityScene />
      </QueryBoundary>
    </QueryClientProvider>,
  );
}

/**
 * 存在しない slug のとき（#524）— communities キャッシュに該当コミュニティが無い状態を再現。
 * inner component（CommunityContent）はレンダーされないため feed/subscription/auth のシードは不要。
 */
function renderNotFoundScene() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  qc.setQueryData(["communities"], []);

  return render(
    <QueryClientProvider client={qc}>
      <QueryBoundary fallback={<MainContentSkeleton />}>
        <CommunityScene />
      </QueryBoundary>
    </QueryClientProvider>,
  );
}

describe("CommunityScene", () => {
  it("h1 にコミュニティの表示名が表示される", async () => {
    renderScene();
    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("AI 開発者の集い");
  });

  it("r/ プレフィックス付き slug は表示されない", async () => {
    renderScene();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText("r/ai-dev")).not.toBeInTheDocument();
  });

  it("コミュニティの説明が表示される", async () => {
    renderScene();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getAllByText("AI ワーカーが日常を語る community").length).toBeGreaterThan(0);
  });

  it("サイドバーに作成日が『YYYY年M月D日 作成』フォーマットで表示される", async () => {
    renderScene();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByText("2026年6月1日 作成")).toBeInTheDocument();
  });

  it("サイドバーにコミュニティ所属ワーカーが表示される（#207 / #462 / #1078）", async () => {
    renderScene();
    expect(await screen.findByText("haru")).toBeInTheDocument();
    expect(screen.getByText("ムードメーカー")).toBeInTheDocument();
  });

  it("コミュニティワーカー取得中はサイドバーに局所ローディングが表示される（#462）", async () => {
    server.use(
      http.get("/api/communities/:slug/workers", async () => {
        await delay(50);
        return HttpResponse.json({ items: mockCommunityWorkers, nextCursor: null });
      }),
    );
    renderScene({ seedCommunityWorkers: false });
    // 本体（見出し）は表示され、ワーカーパネルだけ「読み込み中...」になる
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
    // 完了後にワーカーが表示される
    expect(await screen.findByText("haru")).toBeInTheDocument();
  });

  it("コミュニティワーカー取得に失敗するとサイドバーに失敗メッセージが表示される（#462）", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(
      http.get(
        "/api/communities/:slug/workers",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    renderScene({ seedCommunityWorkers: false });
    expect(await screen.findByText("読み込みに失敗しました")).toBeInTheDocument();
    // 本体（見出し）は表示され続ける
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    errorSpy.mockRestore();
  });

  it("存在しない slug のとき「コミュニティが見つかりません」を表示する（#524）", async () => {
    renderNotFoundScene();
    expect(await screen.findByText("コミュニティが見つかりません")).toBeInTheDocument();
  });

  it("存在しない slug のとき /communities へのリンクを表示する（#524）", async () => {
    renderNotFoundScene();
    await screen.findByText("コミュニティが見つかりません");
    const link = screen.getByRole("link", { name: /コミュニティを探す/ });
    expect(link).toHaveAttribute("href", "/communities");
  });

  it("実在コミュニティで投稿が 0 件のとき待機メッセージを表示する（#524）", async () => {
    renderScene();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByText("このコミュニティにはまだ投稿がありません。")).toBeInTheDocument();
  });

  it("並べ替えボタンに現在の並び順（初期値「新着」）がラベル表示される（#1062）", async () => {
    renderScene();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByRole("button", { name: "新着" })).toBeInTheDocument();
  });

  it("並べ替えボタンに aria-haspopup / aria-expanded / aria-controls が設定される（#1062）", async () => {
    renderScene();
    await screen.findByRole("heading", { level: 1 });
    const sortButton = screen.getByRole("button", { name: "新着" });
    expect(sortButton).toHaveAttribute("aria-haspopup", "true");
    expect(sortButton).toHaveAttribute("aria-expanded", "false");

    await act(async () => {
      await userEvent.click(sortButton);
    });
    expect(sortButton).toHaveAttribute("aria-expanded", "true");
    expect(sortButton).toHaveAttribute("aria-controls");
  });

  it("並べ替えボタンに「並べ替えオプションを開く」ツールチップが設定される（#1062）", async () => {
    renderScene();
    await screen.findByRole("heading", { level: 1 });
    const sortButton = screen.getByRole("button", { name: "新着" });
    await userEvent.hover(sortButton);
    const tooltip = await screen.findByRole("tooltip", {}, { timeout: 5000 });
    expect(tooltip).toHaveTextContent("並べ替えオプションを開く");
  });

  it("並べ替えボタンをクリックするとメニューが開き「新着」「人気」の2項目が表示される（#1062）", async () => {
    renderScene();
    await screen.findByRole("heading", { level: 1 });
    const sortButton = screen.getByRole("button", { name: "新着" });
    await act(async () => {
      await userEvent.click(sortButton);
    });
    expect(screen.getByRole("menuitemradio", { name: "新着" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "人気" })).toBeInTheDocument();
  });

  it("メニューを開いた状態で現在選択中の項目（初期値「新着」）にチェックマークが表示される（#1062）", async () => {
    renderScene();
    await screen.findByRole("heading", { level: 1 });
    const sortButton = screen.getByRole("button", { name: "新着" });
    await act(async () => {
      await userEvent.click(sortButton);
    });
    expect(screen.getByTestId("sort-menu-item-check-latest")).toBeInTheDocument();
    expect(screen.queryByTestId("sort-menu-item-check-popular")).not.toBeInTheDocument();
  });

  it("メニュー項目の選択状態が aria-checked でスクリーンリーダーにも伝わる（#1062）", async () => {
    renderScene();
    await screen.findByRole("heading", { level: 1 });
    const sortButton = screen.getByRole("button", { name: "新着" });
    await act(async () => {
      await userEvent.click(sortButton);
    });
    expect(screen.getByRole("menuitemradio", { name: "新着" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemradio", { name: "人気" })).toHaveAttribute("aria-checked", "false");
  });

  it("メニューで「人気」を選択するとボタンラベルが「人気」に変わりフィードが再取得される（#1062）", async () => {
    server.use(
      http.get("/api/communities/:slug/feed", ({ request }) => {
        const url = new URL(request.url);
        const sort = url.searchParams.get("sort");
        if (sort === "popular") {
          return HttpResponse.json({ posts: [], nextCursor: null });
        }
        return HttpResponse.json({ posts: [], nextCursor: null });
      }),
    );
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    qc.setQueryData(["communities"], [mockCommunity]);
    qc.setQueryData(communityFeedQueryKey({ slug: "ai-dev", sort: "latest" }), {
      pages: [{ posts: [], nextCursor: null }],
      pageParams: [undefined],
    });
    qc.setQueryData(communityFeedQueryKey({ slug: "ai-dev", sort: "popular" }), {
      pages: [{ posts: [], nextCursor: null }],
      pageParams: [undefined],
    });
    qc.setQueryData(communitySubscriptionQueryKey("ai-dev"), { subscribed: false });
    qc.setQueryData(AUTH_ME_QUERY_KEY, null);
    qc.setQueryData(communityWorkersQueryKey("ai-dev"), {
      pages: [{ items: mockCommunityWorkers, nextCursor: null }],
      pageParams: [undefined],
    });

    render(
      <QueryClientProvider client={qc}>
        <QueryBoundary fallback={<MainContentSkeleton />}>
          <CommunityScene />
        </QueryBoundary>
      </QueryClientProvider>,
    );

    await screen.findByRole("heading", { level: 1 });
    const sortButton = screen.getByRole("button", { name: "新着" });
    await act(async () => {
      await userEvent.click(sortButton);
    });
    const popularMenuItem = screen.getByRole("menuitemradio", { name: "人気" });
    await act(async () => {
      await userEvent.click(popularMenuItem);
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "人気" })).toBeInTheDocument();
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  it("フィードに投稿がある場合、各 PostCard に共有ボタンが表示される（#838）", async () => {
    const mockPost = {
      id: "post-838",
      community_id: "community-1",
      slot_key: "2026-06-20-morning",
      seq: 1,
      author: "worker-haru",
      title: "コミュニティフィード ShareButton テスト",
      text: "内容",
      score: 0,
      created_at: "2026-06-20T00:00:00Z",
      comment_count: 0,
    };
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    qc.setQueryData(["communities"], [mockCommunity]);
    qc.setQueryData(communityFeedQueryKey({ slug: "ai-dev" }), {
      pages: [{ posts: [mockPost], nextCursor: null }],
      pageParams: [undefined],
    });
    qc.setQueryData(communitySubscriptionQueryKey("ai-dev"), { subscribed: false });
    qc.setQueryData(AUTH_ME_QUERY_KEY, null);
    qc.setQueryData(communityWorkersQueryKey("ai-dev"), {
      pages: [{ items: mockCommunityWorkers, nextCursor: null }],
      pageParams: [undefined],
    });

    render(
      <QueryClientProvider client={qc}>
        <QueryBoundary fallback={<MainContentSkeleton />}>
          <CommunityScene />
        </QueryBoundary>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("コミュニティフィード ShareButton テスト")).toBeInTheDocument();
    const shareButtons = await screen.findAllByRole("button", { name: /共有/i });
    expect(shareButtons.length).toBeGreaterThanOrEqual(2);
  });
});

describe("CommunityScene — admin pin/unpin（#1089）", () => {
  const pinTestPost = {
    id: "post-1089",
    community_id: "community-1",
    slot_key: "2026-07-11-morning",
    seq: 1,
    author: "worker-haru",
    title: "pin テスト投稿",
    text: "内容",
    score: 0,
    created_at: "2026-07-11T00:00:00Z",
    comment_count: 0,
    tags: [] as string[],
    is_pinned: false,
  };

  function renderWithUser({
    role,
    post = pinTestPost,
  }: {
    role: "admin" | "member" | null;
    post?: typeof pinTestPost;
  }) {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    qc.setQueryData(["communities"], [mockCommunity]);
    qc.setQueryData(communityFeedQueryKey({ slug: "ai-dev" }), {
      pages: [{ posts: [post], nextCursor: null }],
      pageParams: [undefined],
    });
    qc.setQueryData(communitySubscriptionQueryKey("ai-dev"), { subscribed: false });
    qc.setQueryData(
      AUTH_ME_QUERY_KEY,
      role ? { id: "user-1", displayName: "Admin", role } : null,
    );
    qc.setQueryData(communityWorkersQueryKey("ai-dev"), {
      pages: [{ items: mockCommunityWorkers, nextCursor: null }],
      pageParams: [undefined],
    });

    return render(
      <QueryClientProvider client={qc}>
        <QueryBoundary fallback={<MainContentSkeleton />}>
          <CommunityScene />
        </QueryBoundary>
      </QueryClientProvider>,
    );
  }

  it("admin ユーザーには pin 操作ボタンが表示される", async () => {
    renderWithUser({ role: "admin" });
    expect(await screen.findByText("pin テスト投稿")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "固定する" })).toBeInTheDocument();
  });

  it("member ユーザーには pin 操作ボタンが表示されない", async () => {
    renderWithUser({ role: "member" });
    expect(await screen.findByText("pin テスト投稿")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "固定する" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "固定を解除する" })).not.toBeInTheDocument();
  });

  it("未ログインユーザーには pin 操作ボタンが表示されない", async () => {
    renderWithUser({ role: null });
    expect(await screen.findByText("pin テスト投稿")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "固定する" })).not.toBeInTheDocument();
  });

  it("pin 済み post には「固定」ラベルが表示される", async () => {
    renderWithUser({ role: "admin", post: { ...pinTestPost, is_pinned: true } });
    expect(await screen.findByText("pin テスト投稿")).toBeInTheDocument();
    expect(screen.getByText("固定")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "固定を解除する" })).toBeInTheDocument();
  });

  it("admin が pin ボタンをクリックすると pin API が呼ばれる", async () => {
    let pinRequested = false;
    server.use(
      http.post("/api/admin/posts/:id/pin", () => {
        pinRequested = true;
        return HttpResponse.json({ ...pinTestPost, is_pinned: true });
      }),
    );
    renderWithUser({ role: "admin" });
    const pinButton = await screen.findByRole("button", { name: "固定する" });
    await act(async () => {
      await userEvent.click(pinButton);
    });
    await waitFor(() => expect(pinRequested).toBe(true));
  });

  it("admin が unpin ボタンをクリックすると unpin API が呼ばれる", async () => {
    let unpinRequested = false;
    server.use(
      http.delete("/api/admin/posts/:id/pin", () => {
        unpinRequested = true;
        return HttpResponse.json({ ...pinTestPost, is_pinned: false });
      }),
    );
    renderWithUser({ role: "admin", post: { ...pinTestPost, is_pinned: true } });
    const unpinButton = await screen.findByRole("button", { name: "固定を解除する" });
    await act(async () => {
      await userEvent.click(unpinButton);
    });
    await waitFor(() => expect(unpinRequested).toBe(true));
  });
});

describe("CommunityScene — vote 楽観的更新（#924）", () => {
  const votePost = {
    id: "post-924",
    community_id: "community-1",
    slot_key: "2026-06-20-morning",
    seq: 1,
    author: "worker-haru",
    title: "楽観的更新テスト投稿",
    text: "内容",
    score: 5,
    my_vote: null as "up" | "down" | null,
    comment_count: 0,
    created_at: "2026-06-20T00:00:00Z",
  };

  function renderVoteScene(postOverrides: Partial<typeof votePost> = {}) {
    const post = { ...votePost, ...postOverrides };
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    qc.setQueryData(["communities"], [mockCommunity]);
    qc.setQueryData(communityFeedQueryKey({ slug: "ai-dev" }), {
      pages: [{ posts: [post], nextCursor: null }],
      pageParams: [undefined],
    });
    qc.setQueryData(communitySubscriptionQueryKey("ai-dev"), { subscribed: false });
    qc.setQueryData(AUTH_ME_QUERY_KEY, null);
    qc.setQueryData(communityWorkersQueryKey("ai-dev"), {
      pages: [{ items: mockCommunityWorkers, nextCursor: null }],
      pageParams: [undefined],
    });
    render(
      <QueryClientProvider client={qc}>
        <QueryBoundary fallback={<MainContentSkeleton />}>
          <CommunityScene />
        </QueryBoundary>
      </QueryClientProvider>,
    );
  }

  it("up vote 後にアイコンが楽観的更新される（aria-pressed が true になる）", async () => {
    server.use(
      http.post("/api/posts/:postId/vote", async () => {
        await delay("infinite");
        return HttpResponse.json({});
      }),
    );
    renderVoteScene();
    await screen.findByText("楽観的更新テスト投稿");

    const upBtn = screen.getByRole("button", { name: /up vote/i });
    expect(upBtn).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(upBtn);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /up vote/i })).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("up vote 後にスコアが楽観的更新される（+1）", async () => {
    server.use(
      http.post("/api/posts/:postId/vote", async () => {
        await delay("infinite");
        return HttpResponse.json({});
      }),
    );
    renderVoteScene();
    await screen.findByText("楽観的更新テスト投稿");

    await userEvent.click(screen.getByRole("button", { name: /up vote/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /up vote/i })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByText("6")).toBeInTheDocument();
    });
  });

  it("up 済み → 同方向クリックで toggle off される（aria-pressed が false になる）", async () => {
    server.use(
      http.post("/api/posts/:postId/vote", async () => {
        await delay("infinite");
        return HttpResponse.json({});
      }),
    );
    renderVoteScene({ score: 10, my_vote: "up" });
    await screen.findByText("楽観的更新テスト投稿");

    const upBtn = screen.getByRole("button", { name: /up vote/i });
    expect(upBtn).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(upBtn);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /up vote/i })).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByText("9")).toBeInTheDocument();
    });
  });

  it("API エラー時に aria-pressed がロールバックされる", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(
      http.post("/api/posts/:postId/vote", async () => {
        await delay(50);
        return new HttpResponse(null, { status: 500 });
      }),
      // invalidateQueries によるリフェッチで投稿が消えないよう元データを返す
      http.get("/api/communities/:slug/feed", () =>
        HttpResponse.json({ posts: [{ ...votePost, my_vote: null }], nextCursor: null }),
      ),
    );
    renderVoteScene({ my_vote: null });
    await screen.findByText("楽観的更新テスト投稿");

    await userEvent.click(screen.getByRole("button", { name: /up vote/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /up vote/i })).toHaveAttribute("aria-pressed", "true");
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /up vote/i })).toHaveAttribute("aria-pressed", "false");
    });
    errorSpy.mockRestore();
  });
});

describe("CommunityScene — mark-viewed（#934）", () => {
  const mockUser = {
    id: "user-1",
    name: "テスト",
    email: "test@test.com",
    role: "user" as const,
    imageUrl: null,
    isPremium: false,
  };

  function renderSubscribedScene() {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    qc.setQueryData(["communities"], [mockCommunity]);
    qc.setQueryData(communityFeedQueryKey({ slug: "ai-dev" }), {
      pages: [{ posts: [], nextCursor: null }],
      pageParams: [undefined],
    });
    qc.setQueryData(communitySubscriptionQueryKey("ai-dev"), { subscribed: true, notify_enabled: true });
    qc.setQueryData(AUTH_ME_QUERY_KEY, mockUser);
    qc.setQueryData(communityWorkersQueryKey("ai-dev"), {
      pages: [{ items: mockCommunityWorkers, nextCursor: null }],
      pageParams: [undefined],
    });
    qc.setQueryData(unreadCountsQueryKey(), { unread_counts: [] });

    return render(
      <QueryClientProvider client={qc}>
        <QueryBoundary fallback={<></>}>
          <CommunityScene />
        </QueryBoundary>
      </QueryClientProvider>,
    );
  }

  it("購読中コミュニティ訪問時に mark-viewed が自動呼び出しされる", async () => {
    const markViewedSpy = vi.fn();
    server.use(
      http.patch("/api/communities/:slug/mark-viewed", () => {
        markViewedSpy();
        return new HttpResponse(null, { status: 200 });
      }),
    );

    renderSubscribedScene();
    await screen.findByRole("heading", { level: 1 });

    await waitFor(() => {
      expect(markViewedSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("未購読コミュニティ訪問時に mark-viewed は呼ばれない", async () => {
    const markViewedSpy = vi.fn();
    server.use(
      http.patch("/api/communities/:slug/mark-viewed", () => {
        markViewedSpy();
        return new HttpResponse(null, { status: 200 });
      }),
    );

    // renderScene はデフォルトで subscribed: false
    renderScene();
    await screen.findByRole("heading", { level: 1 });
    await new Promise((r) => setTimeout(r, 50));

    expect(markViewedSpy).not.toHaveBeenCalled();
  });
});

describe("CommunityScene — community 単位の通知 ON/OFF トグル（#1088）", () => {
  const mockUser = {
    id: "user-1",
    name: "テスト",
    email: "test@test.com",
    role: "user" as const,
    imageUrl: null,
    isPremium: false,
  };

  function renderSubscribedScene({ notifyEnabled = true }: { notifyEnabled?: boolean } = {}) {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    qc.setQueryData(["communities"], [mockCommunity]);
    qc.setQueryData(communityFeedQueryKey({ slug: "ai-dev" }), {
      pages: [{ posts: [], nextCursor: null }],
      pageParams: [undefined],
    });
    qc.setQueryData(communitySubscriptionQueryKey("ai-dev"), {
      subscribed: true,
      notify_enabled: notifyEnabled,
    });
    qc.setQueryData(AUTH_ME_QUERY_KEY, mockUser);
    qc.setQueryData(communityWorkersQueryKey("ai-dev"), {
      pages: [{ items: mockCommunityWorkers, nextCursor: null }],
      pageParams: [undefined],
    });
    qc.setQueryData(unreadCountsQueryKey(), { unread_counts: [] });
    server.use(http.patch("/api/communities/:slug/mark-viewed", () => new HttpResponse(null, { status: 200 })));

    return { qc, ...render(
      <QueryClientProvider client={qc}>
        <QueryBoundary fallback={<></>}>
          <CommunityScene />
        </QueryBoundary>
      </QueryClientProvider>,
    ) };
  }

  it("購読中は notify_enabled: true のとき「通知をオフにする」トグルが表示される", async () => {
    renderSubscribedScene({ notifyEnabled: true });
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByRole("button", { name: "通知をオフにする" })).toBeInTheDocument();
  });

  it("購読中は notify_enabled: false のとき「通知をオンにする」トグルが表示される", async () => {
    renderSubscribedScene({ notifyEnabled: false });
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByRole("button", { name: "通知をオンにする" })).toBeInTheDocument();
  });

  it("未購読の場合はトグルが表示されない", async () => {
    renderScene();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("button", { name: "通知をオフにする" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "通知をオンにする" })).not.toBeInTheDocument();
  });

  it("トグルをクリックすると PATCH で notify_enabled が反転して送られる", async () => {
    const patchSpy = vi.fn();
    server.use(
      http.patch("/api/communities/:slug/subscription", async ({ request }) => {
        patchSpy(await request.json());
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderSubscribedScene({ notifyEnabled: true });
    await screen.findByRole("heading", { level: 1 });

    await userEvent.click(screen.getByRole("button", { name: "通知をオフにする" }));

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith({ notify_enabled: false });
    });
  });
});

describe("CommunityScene — 著者名がワーカープロフィールへのリンクになる (#1017)", () => {
  it("author_worker を持つ投稿の著者名がリンクとして描画される", async () => {
    const postWithWorker = {
      id: "post-1017",
      community_id: "community-1",
      slot_key: "2026-07-01-morning",
      seq: 1,
      author: "worker-haru",
      title: "著者リンクテスト投稿",
      text: "内容",
      score: 0,
      created_at: "2026-07-01T00:00:00Z",
      comment_count: 0,
      author_worker: { id: "worker-uuid-haru", display_name: "はる", image_url: null },
    };
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    qc.setQueryData(["communities"], [mockCommunity]);
    qc.setQueryData(communityFeedQueryKey({ slug: "ai-dev" }), {
      pages: [{ posts: [postWithWorker], nextCursor: null }],
      pageParams: [undefined],
    });
    qc.setQueryData(communitySubscriptionQueryKey("ai-dev"), { subscribed: false });
    qc.setQueryData(AUTH_ME_QUERY_KEY, null);
    qc.setQueryData(communityWorkersQueryKey("ai-dev"), {
      pages: [{ items: mockCommunityWorkers, nextCursor: null }],
      pageParams: [undefined],
    });

    render(
      <QueryClientProvider client={qc}>
        <QueryBoundary fallback={<MainContentSkeleton />}>
          <CommunityScene />
        </QueryBoundary>
      </QueryClientProvider>,
    );

    await screen.findByText("著者リンクテスト投稿");
    const authorText = screen.getByText("はる");
    expect(authorText.closest("a")).not.toBeNull();
    expect(authorText.closest("a")).toHaveAttribute("href", "/workers/$workerId");
  });
});

describe("CommunityScene — ゲスト購読誘導（#882）", () => {
  const mockUser = {
    id: "user-1",
    name: "テスト",
    email: "test@test.com",
    role: "user" as const,
    imageUrl: null,
    isPremium: false,
  };

  function renderAuthScene() {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    qc.setQueryData(["communities"], [mockCommunity]);
    qc.setQueryData(communityFeedQueryKey({ slug: "ai-dev" }), {
      pages: [{ posts: [], nextCursor: null }],
      pageParams: [undefined],
    });
    qc.setQueryData(communitySubscriptionQueryKey("ai-dev"), { subscribed: false });
    qc.setQueryData(AUTH_ME_QUERY_KEY, mockUser);
    qc.setQueryData(communityWorkersQueryKey("ai-dev"), {
      pages: [{ items: mockCommunityWorkers, nextCursor: null }],
      pageParams: [undefined],
    });
    qc.setQueryData(unreadCountsQueryKey(), { unread_counts: [] });
    return render(
      <QueryClientProvider client={qc}>
        <QueryBoundary fallback={<MainContentSkeleton />}>
          <CommunityScene />
        </QueryBoundary>
      </QueryClientProvider>,
    );
  }

  it("ゲストのとき「ログインして購読」ボタンが表示される", async () => {
    renderScene();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByRole("button", { name: "ログインして購読" })).toBeInTheDocument();
  });

  it("ゲストが「ログインして購読」ボタンをクリックするとログインモーダルが開く（login:1 が付与される）", async () => {
    renderScene();
    await screen.findByRole("heading", { level: 1 });

    await userEvent.click(screen.getByRole("button", { name: "ログインして購読" }));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const searchFn = mockNavigate.mock.calls[0][0].search as (
      prev: Record<string, unknown>
    ) => Record<string, unknown>;
    expect(searchFn({})).toMatchObject({ login: 1 });
  });

  it("認証済みのとき「ログインして購読」ボタンは表示されない", async () => {
    renderAuthScene();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("button", { name: "ログインして購読" })).not.toBeInTheDocument();
  });

  it("認証済みかつ未購読のとき「購読する」ボタンが表示される", async () => {
    renderAuthScene();
    await screen.findByRole("heading", { level: 1 });
    const subscribeButtons = screen.getAllByRole("button", { name: "購読する" });
    expect(subscribeButtons.length).toBeGreaterThan(0);
  });
});

describe("CommunityScene — コミュニティワーカーの無限スクロール（sentinelRef）（#1078）", () => {
  it("hasNextPage=true かつ番兵要素が intersect するとき次ページのワーカーが読み込まれる", async () => {
    let observerCallback: ((entries: IntersectionObserverEntry[]) => void) | null = null;
    vi.stubGlobal(
      "IntersectionObserver",
      vi.fn((cb: (entries: IntersectionObserverEntry[]) => void) => {
        observerCallback = cb;
        return { observe: vi.fn(), disconnect: vi.fn() };
      }),
    );

    server.use(
      http.get("/api/communities/:slug/workers", ({ request }) => {
        const url = new URL(request.url);
        const isNextPage = url.searchParams.has("cursor");
        if (isNextPage) {
          return HttpResponse.json({
            items: [{ id: "worker-2", displayName: "ken", role: "ベテラン" }],
            nextCursor: null,
          });
        }
        return HttpResponse.json({
          items: [{ id: "worker-1", displayName: "haru", role: "ムードメーカー" }],
          nextCursor: "cursor-1",
        });
      }),
    );

    renderScene({ seedCommunityWorkers: false });
    expect(await screen.findByText("haru")).toBeInTheDocument();
    expect(observerCallback).not.toBeNull();

    observerCallback!([{ isIntersecting: true } as IntersectionObserverEntry]);

    expect(await screen.findByText("ken")).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it("hasNextPage=false のとき番兵要素が intersect しても追加読み込みされない", async () => {
    let observerCallback: ((entries: IntersectionObserverEntry[]) => void) | null = null;
    vi.stubGlobal(
      "IntersectionObserver",
      vi.fn((cb: (entries: IntersectionObserverEntry[]) => void) => {
        observerCallback = cb;
        return { observe: vi.fn(), disconnect: vi.fn() };
      }),
    );

    const workersHandler = vi.fn(() =>
      HttpResponse.json({
        items: [{ id: "worker-1", displayName: "haru", role: "ムードメーカー" }],
        nextCursor: null,
      }),
    );
    server.use(http.get("/api/communities/:slug/workers", workersHandler));

    renderScene({ seedCommunityWorkers: false });
    expect(await screen.findByText("haru")).toBeInTheDocument();
    expect(observerCallback).not.toBeNull();
    const callCountBeforeIntersect = workersHandler.mock.calls.length;

    observerCallback!([{ isIntersecting: true } as IntersectionObserverEntry]);

    // 追加のフェッチが発火しないことを確認するため、他の非同期処理が落ち着くまで少し待つ。
    await new Promise((r) => setTimeout(r, 50));
    expect(workersHandler.mock.calls.length).toBe(callCountBeforeIntersect);

    vi.unstubAllGlobals();
  });
});
