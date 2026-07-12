/**
 * DashboardScene のレンダリングテスト（#1113）。
 * 未ログイン状態でもサマリカード・コミュニティ別テーブルが表示されることを検証する
 * （DashboardScene 自体は useAuth 等の認証依存フックを持たない公開ページ）。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DashboardSummary } from "@hatchery/common";

import { DASHBOARD_SUMMARY_QUERY_KEY } from "../api/dashboard.js";
import { QueryBoundary } from "../components/QueryBoundary.js";
import { DashboardScene } from "./DashboardScene.js";

const mockSummary: DashboardSummary = {
  community_count: 2,
  worker_count: 3,
  post_count: 10,
  comment_count: 20,
  total_view_count: 12345,
  total_vote_count: 40,
  total_subscription_count: 5,
  communities: [
    {
      community_id: "community-1",
      slug: "tech",
      name: "Technology",
      post_count: 6,
      subscriber_count: 3,
      view_count: 200,
    },
    {
      community_id: "community-2",
      slug: "news",
      name: "News",
      post_count: 4,
      subscriber_count: 2,
      view_count: 100,
    },
  ],
};

function renderWithData(summary: DashboardSummary = mockSummary) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  qc.setQueryData(DASHBOARD_SUMMARY_QUERY_KEY, summary);
  return render(
    <QueryClientProvider client={qc}>
      <QueryBoundary fallback={<div>読み込み中</div>}>
        <DashboardScene />
      </QueryBoundary>
    </QueryClientProvider>,
  );
}

describe("DashboardScene（#1113）— 未ログインでもレンダリングできる", () => {
  it("見出しが表示される", async () => {
    renderWithData();
    expect(await screen.findByRole("heading", { name: /ダッシュボード/ })).toBeInTheDocument();
  });

  it("サマリカードにコミュニティ数・ワーカー数・投稿数・コメント数・累計閲覧数・累計vote数・購読数が表示される", async () => {
    renderWithData();
    await screen.findByTestId("stat-community_count");
    expect(screen.getByTestId("stat-community_count")).toHaveTextContent("2");
    expect(screen.getByTestId("stat-worker_count")).toHaveTextContent("3");
    expect(screen.getByTestId("stat-post_count")).toHaveTextContent("10");
    expect(screen.getByTestId("stat-comment_count")).toHaveTextContent("20");
    expect(screen.getByTestId("stat-total_view_count")).toHaveTextContent("12,345");
    expect(screen.getByTestId("stat-total_vote_count")).toHaveTextContent("40");
    expect(screen.getByTestId("stat-total_subscription_count")).toHaveTextContent("5");
  });

  it("サマリカードのキャプションが日本語ラベル（フィールド名の生の値ではない）で表示される", async () => {
    renderWithData();
    expect(await screen.findByText("コミュニティ数")).toBeInTheDocument();
    expect(screen.getByText("ワーカー数")).toBeInTheDocument();
    expect(screen.getByText("累計閲覧数")).toBeInTheDocument();
    expect(screen.queryByText("community_count")).not.toBeInTheDocument();
  });

  it("コミュニティ別内訳テーブルに各コミュニティの名前・投稿数・購読者数・閲覧数が表示される", async () => {
    renderWithData();
    const table = await screen.findByRole("table", { name: "コミュニティ別内訳" });
    expect(table).toBeInTheDocument();
    expect(screen.getByText("Technology")).toBeInTheDocument();
    expect(screen.getByText("News")).toBeInTheDocument();
    const rows = screen.getAllByRole("row");
    // ヘッダー行 + データ行 2 件
    expect(rows).toHaveLength(3);
  });

  it("コミュニティ内訳が空のときは空状態メッセージを表示する", async () => {
    renderWithData({ ...mockSummary, communities: [] });
    expect(
      await screen.findByText("まだコミュニティがありません。"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
