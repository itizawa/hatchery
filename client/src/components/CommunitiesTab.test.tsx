/**
 * CommunitiesTab（管理画面のコミュニティ管理タブ）の RTL テスト（#381 / #833 / #889）。
 * #889: 作成・編集をモーダルから専用ページへ移行したため、
 * ボタンがリンクになり、ダイアログは表示されなくなった。
 * 作成・編集フォームの詳細は AddCommunityScene.test.tsx / EditCommunityScene.test.tsx で検証する。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import type { ReactElement } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// TanStack Router の Link をモックして href 付き <a> タグに変換する
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to,
      params,
      search,
    }: {
      children: ReactElement;
      to: string;
      params?: Record<string, string>;
      search?: Record<string, string>;
    }) => {
      let href = to;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          href = href.replace(`$${k}`, v);
        }
      }
      if (search) {
        href = `${href}?${new URLSearchParams(search).toString()}`;
      }
      return <a href={href}>{children}</a>;
    },
  };
});

import { CommunitiesTab } from "./CommunitiesTab";

const existingCommunity = {
  id: "community-1",
  slug: "ai-dev",
  name: "AI 開発者の集い",
  description: "AI ワーカーが日常を語る community",
  created_at: "2026-06-01T00:00:00.000Z",
  post_count: 3,
  last_post_at: "2026-06-10T09:00:00.000Z",
};

const server = setupServer(
  http.get("/api/admin/communities", () => HttpResponse.json([existingCommunity])),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("CommunitiesTab（#889）", () => {
  it("既存コミュニティ一覧（名前・slug）が表示される", async () => {
    renderWithClient(<CommunitiesTab />);
    expect(await screen.findByText("AI 開発者の集い")).toBeInTheDocument();
    expect(screen.getByText("ai-dev")).toBeInTheDocument();
  });

  it("「コミュニティを追加」ボタンが /admin/communities/new へのリンクになる", async () => {
    renderWithClient(<CommunitiesTab />);
    await screen.findByText("AI 開発者の集い");
    const link = screen.getByRole("link", { name: "コミュニティを追加" });
    expect(link).toHaveAttribute("href", "/admin/communities/new");
  });

  it("「編集」ボタンが /admin/communities/:id/edit へのリンクになる", async () => {
    renderWithClient(<CommunitiesTab />);
    await screen.findByText("AI 開発者の集い");
    const link = screen.getByRole("link", { name: "編集" });
    expect(link).toHaveAttribute("href", "/admin/communities/community-1/edit");
  });

  it("ダイアログは表示されない（廃止）", async () => {
    renderWithClient(<CommunitiesTab />);
    await screen.findByText("AI 開発者の集い");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
