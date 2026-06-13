/**
 * PostThreadScene（/posts/$postId）の RTL テスト (#380 / #390 / #462).
 * - #380: MSW で GET /api/posts/:postId をモックし、post 本文・コメント一覧・空状態・
 *   ローディング・エラーの各描画を検証する。ネットワーク実アクセスはしない
 *   （onUnhandledRequest: "error" で素通りを検知）。
 *   投票の楽観更新の詳細は UpVoteButton / communities 側の責務（スコープ外）。
 * - #390: 右サイドバー（コミュニティ詳細カード）の表示を TanStack Query キャッシュの
 *   シードで検証する（staleTime 内のため fetch は発生しない）。
 * - #462: usePostThread / usePublicCommunities を Suspense 化したため、シーンを router と同じく
 *   QueryBoundary（fallback=PostThreadSkeleton）でラップして描画する。ローディングは Suspense
 *   fallback（post-thread-skeleton）、取得失敗は ErrorBoundary フォールバック（再試行ボタン）で検証する。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse, delay } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { PostThreadScene } from "./PostThreadScene";
import { postThreadQueryKey, communitySubscriptionQueryKey } from "../api/communities";
import { AUTH_ME_QUERY_KEY } from "../api/auth";
import { QueryBoundary } from "../components/QueryBoundary";
import { PostThreadSkeleton } from "../components/PostThreadSkeleton";
import { handlers } from "../mocks/handlers.js";
import { mockCommunities, mockPosts } from "../mocks/data/fixtures.js";
import type { Community, Comment } from "../api/communities.js";
import type React from "react";
import { Suspense } from "react";

/** router と同じ構成（QueryBoundary + PostThreadSkeleton fallback）でシーンを包む。 */
function BoundedScene(): React.ReactElement {
  return (
    <QueryBoundary fallback={<PostThreadSkeleton />}>
      <PostThreadScene />
    </QueryBoundary>
  );
}

const mockComments: Comment[] = [
  {
    id: "comment-1",
    community_id: "community-1",
    post_id: "post-1",
    slot_key: "2026-06-01-morning",
    seq: 1,
    author: "worker-ken",
    text: "いい一日になりそうですね！",
    score: 3,
    created_at: "2026-06-01T09:05:00Z",
  },
  {
    id: "comment-2",
    community_id: "community-1",
    post_id: "post-1",
    slot_key: "2026-06-01-morning",
    seq: 2,
    author: "worker-mio",
    text: "私も今日からタスクを進めます。",
    score: 1,
    created_at: "2026-06-01T09:10:00Z",
  },
];

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useParams: () => ({ postId: "post-1" }),
    Link: ({ children, to }: { children: React.ReactNode; to: string; params?: unknown }) => (
      <a href={to}>{children}</a>
    ),
  };
});

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  // #461: useAuth は useSuspenseQuery 化された。これらのテストは post スレッドの描画/ローディングが
  // 関心事のため、認証クエリは事前シードして即解決させ（Suspense を起こさせない）、
  // 念のため Suspense 祖先（実アプリではルートの Suspense 相当）も用意する。
  qc.setQueryData(AUTH_ME_QUERY_KEY, null);
  return (
    <QueryClientProvider client={qc}>
      <Suspense fallback={null}>{children}</Suspense>
    </QueryClientProvider>
  );
}

describe("PostThreadScene (#380)", () => {
  it("post のタイトル・本文・author が表示される", async () => {
    render(<BoundedScene />, { wrapper: Wrapper });

    expect(await screen.findByText("今日も元気に始めましょう")).toBeInTheDocument();
    expect(
      screen.getByText("おはようございます！今日もよろしくお願いします。"),
    ).toBeInTheDocument();
    expect(screen.getByText("worker-haru")).toBeInTheDocument();
  });

  it("コメントが 1 件以上あるときコメント一覧（CommentCard）が描画される", async () => {
    server.use(
      http.get("/api/posts/:postId", () =>
        HttpResponse.json({ post: mockPosts[0], comments: mockComments }),
      ),
    );
    render(<BoundedScene />, { wrapper: Wrapper });

    expect(await screen.findByText("コメント 2 件")).toBeInTheDocument();
    expect(screen.getByText("worker-ken")).toBeInTheDocument();
    expect(screen.getByText("いい一日になりそうですね！")).toBeInTheDocument();
    expect(screen.getByText("worker-mio")).toBeInTheDocument();
    expect(screen.getByText("私も今日からタスクを進めます。")).toBeInTheDocument();
  });

  it("コメント 0 件のとき空状態の文言が表示される", async () => {
    server.use(
      http.get("/api/posts/:postId", () => HttpResponse.json({ post: mockPosts[0], comments: [] })),
    );
    render(<BoundedScene />, { wrapper: Wrapper });

    expect(
      await screen.findByText("まだコメントはありません。AI ワーカーが定時にコメントします。"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/コメント \d+ 件/)).not.toBeInTheDocument();
  });

  it("データ取得中はスケルトンが描画され「読み込み中...」テキストは表示されない", async () => {
    server.use(
      http.get("/api/posts/:postId", async () => {
        await delay(100);
        return HttpResponse.json({ post: mockPosts[0], comments: [] });
      }),
    );
    render(<BoundedScene />, { wrapper: Wrapper });

    // ローディング中はスケルトンが表示され、テキスト「読み込み中...」は出ない
    expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
    expect(screen.getByTestId("post-thread-skeleton")).toBeInTheDocument();
    // ローディング完了後は post が表示される（後始末を兼ねて完了まで待つ）。
    expect(await screen.findByText("今日も元気に始めましょう")).toBeInTheDocument();
  });

  it("取得に失敗したとき ErrorBoundary の再試行フォールバックが表示される（#462）", async () => {
    // 子が throw すると React が console.error を出すため抑制する。
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(
      http.get("/api/posts/:postId", () => new HttpResponse(null, { status: 500 })),
    );
    render(<BoundedScene />, { wrapper: Wrapper });

    expect(await screen.findByText("データの取得に失敗しました。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "再試行" })).toBeInTheDocument();
    errorSpy.mockRestore();
  });
});

// #390: 右サイドバー（コミュニティ詳細カード）。
// TanStack Query キャッシュをシードして描画する（staleTime 内のため fetch は発生しない）。
function createWrapper({ communities }: { communities: Community[] }) {
  return function SeededWrapper({ children }: { children: React.ReactNode }) {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    qc.setQueryData(postThreadQueryKey("post-1"), {
      post: mockPosts[0],
      comments: [mockComments[0]],
    });
    qc.setQueryData(["communities"], communities);
    qc.setQueryData(communitySubscriptionQueryKey("ai-dev"), { subscribed: false });
    qc.setQueryData(AUTH_ME_QUERY_KEY, null);

    return (
      <QueryClientProvider client={qc}>
        <Suspense fallback={null}>{children}</Suspense>
      </QueryClientProvider>
    );
  };
}

describe("PostThreadScene サイドバー (#390)", () => {
  it("post 本文とコメントを表示する（既存表示の維持）", async () => {
    render(<BoundedScene />, { wrapper: createWrapper({ communities: mockCommunities }) });
    expect(await screen.findByText("今日も元気に始めましょう")).toBeInTheDocument();
    expect(
      screen.getByText("おはようございます！今日もよろしくお願いします。"),
    ).toBeInTheDocument();
    expect(screen.getByText("コメント 1 件")).toBeInTheDocument();
    expect(screen.getByText("いい一日になりそうですね！")).toBeInTheDocument();
  });

  it("サイドバーに post の所属コミュニティ名がリンクとして表示される", async () => {
    render(<BoundedScene />, { wrapper: createWrapper({ communities: mockCommunities }) });
    await screen.findByText("今日も元気に始めましょう");
    const link = screen.getByRole("link", { name: "AI 開発者の集い" });
    expect(link).toHaveAttribute("href", "/communities/$slug");
  });

  it("サイドバーにコミュニティの説明と作成日が表示される", async () => {
    render(<BoundedScene />, { wrapper: createWrapper({ communities: mockCommunities }) });
    await screen.findByText("今日も元気に始めましょう");
    expect(screen.getByText("AI ワーカーが日常を語る community")).toBeInTheDocument();
    expect(screen.getByText("2026年6月1日 作成")).toBeInTheDocument();
  });

  it("サイドバーにシェアボタンが表示される（PostCard の共有ボタンに加えて 2 つ目）", async () => {
    render(<BoundedScene />, { wrapper: createWrapper({ communities: mockCommunities }) });
    await screen.findByText("今日も元気に始めましょう");
    expect(screen.getAllByRole("button", { name: /共有/i }).length).toBeGreaterThanOrEqual(2);
  });

  it("未ログイン時はサイドバーに購読ボタンを表示しない", async () => {
    render(<BoundedScene />, { wrapper: createWrapper({ communities: mockCommunities }) });
    await screen.findByText("今日も元気に始めましょう");
    expect(screen.queryByRole("button", { name: "購読する" })).not.toBeInTheDocument();
  });

  it("コミュニティが特定できない場合はサイドバーを表示しない（post は表示する）", async () => {
    render(<BoundedScene />, { wrapper: createWrapper({ communities: [] }) });
    expect(await screen.findByText("今日も元気に始めましょう")).toBeInTheDocument();
    expect(screen.queryByText("AI 開発者の集い")).not.toBeInTheDocument();
    expect(screen.queryByText("2026年6月1日 作成")).not.toBeInTheDocument();
  });
});

// #409: レイアウトシフト解消（スケルトン）。
describe("PostThreadScene レイアウトシフト解消 (#409)", () => {
  function createPostOnlyWrapper() {
    return function PostOnlyWrapper({ children }: { children: React.ReactNode }) {
      const qc = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      });
      // post はシードし、communities はシードしない（fetch が走る）
      qc.setQueryData(postThreadQueryKey("post-1"), {
        post: mockPosts[0],
        comments: [],
      });
      qc.setQueryData(communitySubscriptionQueryKey("ai-dev"), { subscribed: false });
      qc.setQueryData(AUTH_ME_QUERY_KEY, null);
      return (
        <QueryClientProvider client={qc}>
          <Suspense fallback={null}>{children}</Suspense>
        </QueryClientProvider>
      );
    };
  }

  it("usePostThread ローディング中はスケルトンが描画される（2カラム構造）", async () => {
    server.use(
      http.get("/api/posts/:postId", async () => {
        await delay(100);
        return HttpResponse.json({ post: mockPosts[0], comments: [] });
      }),
    );
    render(<BoundedScene />, { wrapper: Wrapper });

    expect(screen.getByTestId("post-thread-skeleton")).toBeInTheDocument();
    // ローディング完了後はコンテンツが表示される
    expect(await screen.findByText("今日も元気に始めましょう")).toBeInTheDocument();
    expect(screen.queryByTestId("post-thread-skeleton")).not.toBeInTheDocument();
  });

  it("communities ローディング中は右サイドバー領域にスケルトンが描画される", () => {
    server.use(
      http.get("/api/communities", async () => {
        await delay("infinite");
        return HttpResponse.json(mockCommunities);
      }),
    );
    render(<BoundedScene />, { wrapper: createPostOnlyWrapper() });

    // post はシード済み → 即時表示
    expect(screen.getByText("今日も元気に始めましょう")).toBeInTheDocument();
    // communities ロード中 → サイドバースケルトンが表示される
    expect(screen.getByTestId("community-sidebar-skeleton")).toBeInTheDocument();
    expect(screen.queryByText("AI 開発者の集い")).not.toBeInTheDocument();
  });
});
