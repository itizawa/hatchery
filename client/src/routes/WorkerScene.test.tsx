/**
 * WorkerScene のレンダリングテスト（#929）。
 * ワーカー詳細 + 投稿一覧の表示と空状態を検証する。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WORKER_DETAIL_QUERY_KEY, WORKER_POSTS_QUERY_KEY } from "../api/workers.js";
import { QueryBoundary } from "../components/QueryBoundary.js";
import { WorkerScene } from "./WorkerScene.js";
import type { components } from "../api/openapi.gen.js";
import type React from "react";

type Worker = components["schemas"]["Worker"];
type Post = components["schemas"]["Post"];

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useParams: () => ({ workerId: "worker-abc" }),
    Link: ({ children, to }: { children: React.ReactNode; to: string; params?: unknown }) => (
      <a href={to}>{children}</a>
    ),
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

function renderWithData({
  worker = mockWorker,
  posts = [mockPost],
}: {
  worker?: Worker | null;
  posts?: Post[];
} = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  if (worker) {
    qc.setQueryData(WORKER_DETAIL_QUERY_KEY("worker-abc"), worker);
  }
  qc.setQueryData(WORKER_POSTS_QUERY_KEY("worker-abc"), posts);
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
});
