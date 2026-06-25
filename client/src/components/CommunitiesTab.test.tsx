/**
 * CommunitiesTab（管理画面のコミュニティ管理タブ）の RTL テスト（#381 / #833 / #889）。
 * #889 でコミュニティの作成・編集をダイアログからページ遷移に移行したため、
 * 本タブのテストは「ボタンでページ遷移する」フローと一覧表示の検証に絞る。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import type { ReactElement } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import { CommunitiesTab } from "./CommunitiesTab";

/** 一覧 GET が返す既存コミュニティ（編集テストの前提データ）。 */
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
afterEach(() => {
  server.resetHandlers();
  mockNavigate.mockReset();
});
afterAll(() => server.close());

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("CommunitiesTab（#833 / #889）", () => {
  it("既存コミュニティ一覧（名前・slug）が表示される", async () => {
    renderWithClient(<CommunitiesTab />);
    expect(await screen.findByText("AI 開発者の集い")).toBeInTheDocument();
    expect(screen.getByText("ai-dev")).toBeInTheDocument();
  });

  it("インライン作成フォーム（「新しいコミュニティを作成」）は表示されない", async () => {
    renderWithClient(<CommunitiesTab />);
    await screen.findByText("AI 開発者の集い");
    expect(screen.queryByText("新しいコミュニティを作成")).not.toBeInTheDocument();
  });

  it("「コミュニティを追加」ボタンをクリックすると /admin/communities/new へ遷移する", async () => {
    renderWithClient(<CommunitiesTab />);
    await screen.findByText("AI 開発者の集い");
    await userEvent.click(screen.getByRole("button", { name: "コミュニティを追加" }));
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: "/admin/communities/new" }),
    );
  });

  it("「コミュニティを追加」ボタンクリックでダイアログは開かない", async () => {
    renderWithClient(<CommunitiesTab />);
    await screen.findByText("AI 開発者の集い");
    await userEvent.click(screen.getByRole("button", { name: "コミュニティを追加" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("一覧の「編集」ボタンをクリックすると /admin/communities/:id/edit へ遷移する", async () => {
    renderWithClient(<CommunitiesTab />);
    await screen.findByText("AI 開発者の集い");
    await userEvent.click(screen.getByRole("button", { name: "編集" }));
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/admin/communities/$communityId/edit",
        params: { communityId: "community-1" },
      }),
    );
  });

  it("「編集」ボタンクリックでダイアログは開かない", async () => {
    renderWithClient(<CommunitiesTab />);
    await screen.findByText("AI 開発者の集い");
    await userEvent.click(screen.getByRole("button", { name: "編集" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
