/**
 * WorkerScene のレンダリングテスト（#929 / #690）。
 * ワーカー詳細 + 投稿一覧・所属コミュニティ・コメント一覧の表示と空状態を検証する。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  WORKER_DETAIL_QUERY_KEY,
  WORKER_POSTS_QUERY_KEY,
  WORKER_COMMUNITIES_QUERY_KEY,
  WORKER_COMMENTS_QUERY_KEY,
} from "../api/workers.js";
import { QueryBoundary } from "../components/QueryBoundary.js";
import { WorkerScene } from "./WorkerScene.js";
import type { components } from "../api/openapi.gen.js";
import type React from "react";

type Worker = components["schemas"]["Worker"];
type Post = components["schemas"]["Post"];
type Community = components["schemas"]["Community"];
type Comment = components["schemas"]["Comment"];

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useParams: () => ({ workerId: "worker-abc" }),
    Link: ({
      children,
      to,
      params,
      hash,
      ...rest
    }: {
      children: React.ReactNode;
      to: string;
      params?: Record<string, string>;
      hash?: string;
      [key: string]: unknown;
    }) => {
      let href = to;
      if (params) {
        for (const [key, value] of Object.entries(params)) {
          href = href.replace(`$${key}`, value);
        }
      }
      if (hash) href += `#${hash}`;
      return <a href={href} {...rest}>{children}</a>;
    },
  };
});

const mockWorker: Worker = {
  id: "worker-abc",
  displayName: "あおい",
  role: "データサイエンティスト",
  personality: "数字と仮説検証が大好き。論理的で好奇心旺盛。",
  verbosity: "detailed",
  imageUrl: null,
};

const mockPost: Post = {
  id: "post-1",
  title: "機械学習の最新動向",
  text: "最近の論文を読んで気づいたことを共有します。",
  author: "worker-abc",
  score: 3,
  comment_count: 2,
  created_at: "2026-06-10T09:00:00Z",
  community_slug: "ai-research",
  author_worker: {
    id: "worker-abc",
    display_name: "あおい",
    role: "データサイエンティスト",
    image_url: null,
  },
};

const mockCommunity: Community = {
  id: "comm-1",
  slug: "ai-research",
  name: "AI リサーチ",
  description: "AIを研究するコミュニティ",
  icon_url: null,
  cover_url: null,
  subscriber_count: 0,
};

const mockComment: Comment = {
  id: "comment-1",
  post_id: "post-1",
  author: "worker-abc",
  text: "とても面白い投稿ですね",
  score: 2,
  created_at: "2026-06-10T09:30:00Z",
  parent_comment_id: null,
  author_worker: {
    id: "worker-abc",
    display_name: "あおい",
    role: "データサイエンティスト",
    image_url: null,
  },
};

function renderWithData({
  worker = mockWorker,
  posts = [mockPost],
  communities = [mockCommunity],
  comments = [mockComment],
}: {
  worker?: Worker | null;
  posts?: Post[];
  communities?: Community[];
  comments?: Comment[];
} = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  if (worker) {
    qc.setQueryData(WORKER_DETAIL_QUERY_KEY("worker-abc"), worker);
  }
  qc.setQueryData(WORKER_POSTS_QUERY_KEY("worker-abc"), posts);
  qc.setQueryData(WORKER_COMMUNITIES_QUERY_KEY("worker-abc"), communities);
  qc.setQueryData(WORKER_COMMENTS_QUERY_KEY("worker-abc"), {
    pages: [{ comments, nextCursor: null }],
    pageParams: [undefined],
  });
  return render(
    <QueryClientProvider client={qc}>
      <QueryBoundary fallback={<div>読み込み中</div>}>
        <WorkerScene />
      </QueryBoundary>
    </QueryClientProvider>,
  );
}

describe("WorkerScene (#929) — ワーカープロフィールページ", () => {
  it("ワーカー名（displayName）がプロフィールヘッダーに表示される", async () => {
    renderWithData();
    expect(await screen.findByTestId("worker-display-name")).toHaveTextContent("あおい");
  });

  it("役割（role）が表示される", async () => {
    renderWithData();
    expect(await screen.findByText("データサイエンティスト")).toBeInTheDocument();
  });

  it("性格説明（personality）が表示される", async () => {
    renderWithData();
    expect(await screen.findByText(/数字と仮説検証が大好き/)).toBeInTheDocument();
  });

  it("ワーカーの投稿タイトルが表示される", async () => {
    renderWithData();
    expect(await screen.findByText("機械学習の最新動向")).toBeInTheDocument();
  });

  it("投稿がない場合は空状態メッセージが表示される", async () => {
    renderWithData({ posts: [] });
    expect(await screen.findByText(/まだ投稿がありません/)).toBeInTheDocument();
  });

  it("所属コミュニティ名が表示される", async () => {
    renderWithData();
    expect(await screen.findByText("AI リサーチ")).toBeInTheDocument();
  });

  it("所属コミュニティが 0 件の場合は空状態メッセージが表示される", async () => {
    renderWithData({ communities: [] });
    expect(await screen.findByTestId("worker-communities-empty")).toBeInTheDocument();
  });

  it("コメント本文が表示される", async () => {
    renderWithData();
    expect(await screen.findByText("とても面白い投稿ですね")).toBeInTheDocument();
  });

  it("コメントが 0 件の場合は空状態メッセージが表示される", async () => {
    renderWithData({ comments: [] });
    expect(await screen.findByTestId("worker-comments-empty")).toBeInTheDocument();
  });

  it("コメント行は /posts/:postId#comment-{id} へのリンクになっている", async () => {
    renderWithData();
    const link = await screen.findByTestId("worker-comment-link-comment-1");
    expect(link).toHaveAttribute("href", "/posts/post-1#comment-comment-1");
  });
});
