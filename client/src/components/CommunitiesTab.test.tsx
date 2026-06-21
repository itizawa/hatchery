/**
 * CommunitiesTab（管理画面のコミュニティ管理タブ）の RTL テスト（#381 / #833）。
 * #833 でコミュニティの作成・編集をモーダルダイアログ方式に統一したため、
 * 本タブのテストは「ボタンでダイアログを開く」フローと一覧表示の検証に絞る。
 * 作成・編集フォームの詳細（バリデーション・送信 body・maxLength）は
 * AddCommunityDialog.test.tsx / EditCommunityDialog.test.tsx で検証する。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import type { ReactElement } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

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
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("CommunitiesTab（#833）", () => {
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

  it("「コミュニティを追加」ボタンをクリックすると作成ダイアログが開く", async () => {
    renderWithClient(<CommunitiesTab />);
    await screen.findByText("AI 開発者の集い");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "コミュニティを追加" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("コミュニティを追加")).toBeInTheDocument();
  });

  it("一覧の「編集」ボタンをクリックすると編集ダイアログが開く（インライン展開ではない）", async () => {
    renderWithClient(<CommunitiesTab />);
    await screen.findByText("AI 開発者の集い");

    await userEvent.click(screen.getByRole("button", { name: "編集" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("コミュニティ編集")).toBeInTheDocument();
    // 既存値がダイアログに初期表示される
    expect(within(dialog).getByRole("textbox", { name: /コミュニティ名/ })).toHaveValue(
      "AI 開発者の集い",
    );
  });

  it("追加ダイアログのキャンセルでダイアログが閉じる", async () => {
    renderWithClient(<CommunitiesTab />);
    await screen.findByText("AI 開発者の集い");

    await userEvent.click(screen.getByRole("button", { name: "コミュニティを追加" }));
    await screen.findByRole("dialog");
    await userEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
