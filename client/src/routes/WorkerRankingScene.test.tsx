// WorkerRankingScene の文言変更（「評価（7日）」「賛成から反対を引いた評価スコア」）を検証するテスト（#774）。
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WORKER_RANKING_QUERY_KEY } from "../api/workers.js";
import { QueryBoundary } from "../components/QueryBoundary.js";
import { WorkerRankingScene } from "./WorkerRankingScene.js";
import type { WorkerRankingItem } from "@hatchery/common";

const mockWorkers: WorkerRankingItem[] = [
  { worker_id: "worker-1", display_name: "Alice", view_count: 100, vote_net_score: 5 },
  { worker_id: "worker-2", display_name: "Bob", view_count: 50, vote_net_score: -3 },
];

function renderWithData(workers: WorkerRankingItem[] = mockWorkers) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  qc.setQueryData(WORKER_RANKING_QUERY_KEY, workers);
  return render(
    <QueryClientProvider client={qc}>
      <QueryBoundary fallback={<div>読み込み中</div>}>
        <WorkerRankingScene />
      </QueryBoundary>
    </QueryClientProvider>,
  );
}

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
    expect(await screen.findByText("Bob")).toBeInTheDocument();
  });

  it("データが空のとき「まだランキングデータがありません。」が表示される", async () => {
    renderWithData([]);
    expect(
      await screen.findByText("まだランキングデータがありません。"),
    ).toBeInTheDocument();
  });
});
