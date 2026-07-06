/**
 * WorkerRankingScene のレンダリングテスト（#774）。
 * 文言変更（「評価（7日）」「賛成から反対を引いた評価スコア」）と
 * 負値スコアの色変更を検証する。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type React from "react";

import { TRENDING_ITEMS_QUERY_KEY } from "../api/ranking.js";
import { WORKER_RANKING_QUERY_KEY } from "../api/workers.js";
import { QueryBoundary } from "../components/QueryBoundary.js";
import { WorkerRankingScene } from "./WorkerRankingScene.js";
import type { TrendingItem, WorkerRankingItem } from "@hatchery/common";

// #1065: 右サイドバーの TrendingSidebarCard が RouterLink を使うため、
// RouterProvider 無しでレンダリングできるよう Link をモックする（RecentPostsSidebarCard.test.tsx と同様）。
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  };
});

const mockWorkers: WorkerRankingItem[] = [
  { worker_id: "worker-1", display_name: "Alice", view_count: 100, vote_net_score: 5, image_url: null },
  { worker_id: "worker-2", display_name: "Bob", view_count: 50, vote_net_score: -3, image_url: "https://example.com/bob.png" },
];

const mockTrendingItems: TrendingItem[] = [
  {
    type: "post",
    id: "post-1",
    post_id: "post-1",
    excerpt: "直近7日で人気の投稿本文",
    community_id: "community-1",
    community_slug: "ai-dev",
    net_score: 8,
    created_at: "2026-07-01T09:00:00.000Z",
  },
];

function renderWithData({
  workers = mockWorkers,
  trendingItems = mockTrendingItems,
}: { workers?: WorkerRankingItem[]; trendingItems?: TrendingItem[] } = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  qc.setQueryData(WORKER_RANKING_QUERY_KEY, workers);
  qc.setQueryData(TRENDING_ITEMS_QUERY_KEY, trendingItems);
  return render(
    <QueryClientProvider client={qc}>
      <QueryBoundary fallback={<div>読み込み中</div>}>
        <WorkerRankingScene />
      </QueryBoundary>
    </QueryClientProvider>,
  );
}

const bigWorkers: WorkerRankingItem[] = [
  { worker_id: "worker-big", display_name: "Charlie", view_count: 12345, vote_net_score: 10, image_url: null },
  { worker_id: "worker-neg", display_name: "Dave", view_count: 678, vote_net_score: -7, image_url: "https://example.com/dave.png" },
];

describe("WorkerRankingScene (#784) — 順位番号・閲覧数・スコア色分け", () => {
  it("順位番号（1, 2, …）が表示される", async () => {
    renderWithData({ workers: bigWorkers });
    expect(await screen.findByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("閲覧数が toLocaleString 形式（カンマ区切り）で表示される", async () => {
    renderWithData({ workers: bigWorkers });
    expect(await screen.findByText("12,345")).toBeInTheDocument();
  });

  it("vote_net_score >= 0 のとき score-positive testid セルに + プレフィックス付きで表示される", async () => {
    renderWithData({ workers: bigWorkers });
    const cell = await screen.findByTestId("score-positive");
    expect(cell).toHaveTextContent("+10");
  });

  it("vote_net_score < 0 のとき score-negative testid セルに符号付きで表示される", async () => {
    renderWithData({ workers: bigWorkers });
    const cell = await screen.findByTestId("score-negative");
    expect(cell).toHaveTextContent("-7");
  });

  it("データが空のとき data-testid ranking-empty が表示される", async () => {
    renderWithData({ workers: [] });
    expect(await screen.findByTestId("ranking-empty")).toBeInTheDocument();
  });
});

describe("WorkerRankingScene (#774)", () => {
  it("テーブルの列見出しが「評価（7日）」と表示される", async () => {
    renderWithData();
    expect(await screen.findByText("評価（7日）")).toBeInTheDocument();
  });

  it("旧見出し「Vote スコア（7日）」は表示されない", async () => {
    renderWithData();
    await screen.findByText("評価（7日）");
    expect(screen.queryByText("Vote スコア（7日）")).not.toBeInTheDocument();
  });

  it("説明文に「賛成から反対を引いた評価スコア」が含まれる", async () => {
    renderWithData();
    expect(await screen.findByText(/賛成から反対を引いた評価スコア/)).toBeInTheDocument();
  });

  it("旧説明文「純 Vote スコア（up − down）」は表示されない", async () => {
    renderWithData();
    await screen.findByText(/賛成から反対を引いた評価スコア/);
    expect(screen.queryByText(/純 Vote スコア/)).not.toBeInTheDocument();
  });

  it("正値スコアに + プレフィックスが付く", async () => {
    renderWithData();
    expect(await screen.findByText("+5")).toBeInTheDocument();
  });

  it("負値スコアに符号付き表示がされる", async () => {
    renderWithData();
    expect(await screen.findByText("-3")).toBeInTheDocument();
  });

  it("ワーカー名が表示される", async () => {
    renderWithData();
    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("データが空のとき「まだランキングデータがありません。」が表示される", async () => {
    renderWithData({ workers: [] });
    expect(
      await screen.findByText("まだランキングデータがありません。"),
    ).toBeInTheDocument();
  });
});

describe("WorkerRankingScene (#956) — アバター表示", () => {
  it("各ランキング行にワーカー名を alt とした Avatar が表示される", async () => {
    renderWithData();
    expect(await screen.findByRole("img", { name: "Alice" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Bob" })).toBeInTheDocument();
  });

  it("image_url が null のとき Avatar が存在し alt に表示名が設定される（自動生成 URL がフォールバックとして使われる）", async () => {
    renderWithData({ workers: [{ worker_id: "w-1", display_name: "Alice", view_count: 10, vote_net_score: 1, image_url: null }] });
    await screen.findByText("Alice");
    expect(screen.getByRole("img", { name: "Alice" })).toBeInTheDocument();
  });

  it("データが空のとき Avatar は表示されない", async () => {
    renderWithData({ workers: [] });
    await screen.findByTestId("ranking-empty");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

describe("WorkerRankingScene（#1065）— 2カラムレイアウト・右サイドバー", () => {
  it("左カラムのランキングテーブルと右サイドバーのトレンドカードが同時に表示される", async () => {
    renderWithData();
    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("直近7日で人気の投稿本文")).toBeInTheDocument();
  });

  it("右サイドバーの見出し「直近7日の高評価」が表示される", async () => {
    renderWithData();
    expect(await screen.findByText("直近7日の高評価")).toBeInTheDocument();
  });

  it("トレンドアイテムが 0 件のとき data-testid=trending-sidebar-empty が表示される", async () => {
    renderWithData({ workers: mockWorkers, trendingItems: [] });
    expect(await screen.findByTestId("trending-sidebar-empty")).toBeInTheDocument();
  });

  it("ワーカーランキングが空でもトレンドサイドバーは独立して表示される", async () => {
    renderWithData({ workers: [], trendingItems: mockTrendingItems });
    await screen.findByTestId("ranking-empty");
    expect(screen.getByText("直近7日で人気の投稿本文")).toBeInTheDocument();
  });
});
