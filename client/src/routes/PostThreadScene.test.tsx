/**
 * PostThreadScene（/posts/$postId）の RTL テスト (#380)。
 * MSW で GET /api/posts/:postId をモックし、post 本文・コメント一覧・空状態・
 * ローディング・エラーの各描画を検証する。ネットワーク実アクセスはしない
 * （onUnhandledRequest: "error" で素通りを検知）。
 * 投票の楽観更新の詳細は UpVoteButton / communities 側の責務（スコープ外）。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse, delay } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { PostThreadScene } from "./PostThreadScene";
import { handlers } from "../mocks/handlers.js";
import { mockPosts } from "../mocks/data/fixtures.js";
import type { Comment } from "../api/communities.js";
import type React from "react";

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
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("PostThreadScene (#380)", () => {
  it("post のタイトル・本文・author が表示される", async () => {
    render(<PostThreadScene />, { wrapper: Wrapper });

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
    render(<PostThreadScene />, { wrapper: Wrapper });

    expect(await screen.findByText("コメント 2 件")).toBeInTheDocument();
    expect(screen.getByText("worker-ken")).toBeInTheDocument();
    expect(screen.getByText("いい一日になりそうですね！")).toBeInTheDocument();
    expect(screen.getByText("worker-mio")).toBeInTheDocument();
    expect(screen.getByText("私も今日からタスクを進めます。")).toBeInTheDocument();
  });

  it("コメント 0 件のとき空状態の文言が表示される", async () => {
    server.use(
      http.get("/api/posts/:postId", () =>
        HttpResponse.json({ post: mockPosts[0], comments: [] }),
      ),
    );
    render(<PostThreadScene />, { wrapper: Wrapper });

    expect(
      await screen.findByText("まだコメントはありません。AI ワーカーが定時にコメントします。"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/コメント \d+ 件/)).not.toBeInTheDocument();
  });

  it("データ取得中はローディング表示「読み込み中...」が出る", async () => {
    server.use(
      http.get("/api/posts/:postId", async () => {
        await delay(100);
        return HttpResponse.json({ post: mockPosts[0], comments: [] });
      }),
    );
    render(<PostThreadScene />, { wrapper: Wrapper });

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
    // ローディング完了後は post が表示される（後始末を兼ねて完了まで待つ）。
    expect(await screen.findByText("今日も元気に始めましょう")).toBeInTheDocument();
  });

  it("取得に失敗したときエラーメッセージが表示される", async () => {
    server.use(
      http.get("/api/posts/:postId", () => new HttpResponse(null, { status: 500 })),
    );
    render(<PostThreadScene />, { wrapper: Wrapper });

    expect(await screen.findByText("投稿の取得に失敗しました。")).toBeInTheDocument();
  });
});
