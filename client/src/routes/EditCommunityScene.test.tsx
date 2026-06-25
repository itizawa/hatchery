/**
 * EditCommunityScene のレンダリングテスト（#889）。
 * コミュニティ編集ページ（/admin/communities/:communityId/edit）のフォーム表示と送信動作を検証する。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type React from "react";

import type { AdminCommunity } from "@hatchery/common";

const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useParams: () => ({ communityId: "community-abc" }),
    useNavigate: () => mockNavigate,
    Link: ({ children, to, search }: { children: React.ReactNode; to: string; search?: unknown }) => (
      <a href={search ? `${to}?${new URLSearchParams(search as Record<string, string>).toString()}` : to}>{children}</a>
    ),
  };
});

vi.mock("../api/communities.js", () => ({
  useCommunities: vi.fn(),
  useUpdateCommunity: vi.fn(),
}));

vi.mock("../components/CommunityImageUpload.js", () => ({
  CommunityImageUpload: ({ name, kind }: { name: string; kind: string }) => (
    <div data-testid={`community-image-upload-${kind}`}>CommunityImageUpload: {name}</div>
  ),
}));

import { useCommunities, useUpdateCommunity } from "../api/communities.js";
import { EditCommunityScene } from "./EditCommunityScene.js";

const mockCommunity: AdminCommunity = {
  id: "community-abc",
  slug: "ai-dev",
  name: "AI 開発者の集い",
  description: "AI について語る community",
  generationInstruction: "率直に話す",
  iconUrl: null,
  coverUrl: null,
  created_at: new Date("2026-06-01T00:00:00.000Z"),
  post_count: 3,
  last_post_at: null,
};

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function stubAll(opts?: {
  communities?: AdminCommunity[];
  updateMutateAsync?: ReturnType<typeof vi.fn>;
}) {
  vi.mocked(useCommunities).mockReturnValue({
    data: opts?.communities ?? [mockCommunity],
  } as ReturnType<typeof useCommunities>);

  vi.mocked(useUpdateCommunity).mockReturnValue({
    mutateAsync: opts?.updateMutateAsync ?? vi.fn().mockResolvedValue(mockCommunity),
    isPending: false,
    isError: false,
    error: null,
    reset: vi.fn(),
  } as unknown as ReturnType<typeof useUpdateCommunity>);
}

describe("EditCommunityScene（#889）", () => {
  it("ページタイトル「コミュニティを編集」が表示される", () => {
    stubAll();
    renderWithClient(<EditCommunityScene />);
    expect(screen.getByRole("heading", { name: "コミュニティを編集" })).toBeInTheDocument();
  });

  it("コミュニティ名がフォームに反映される", () => {
    stubAll();
    renderWithClient(<EditCommunityScene />);
    expect(screen.getByDisplayValue("AI 開発者の集い")).toBeInTheDocument();
  });

  it("コミュニティ概要がフォームに反映される", () => {
    stubAll();
    renderWithClient(<EditCommunityScene />);
    expect(screen.getByDisplayValue("AI について語る community")).toBeInTheDocument();
  });

  it("生成プロンプト指示がフォームに反映される", () => {
    stubAll();
    renderWithClient(<EditCommunityScene />);
    expect(screen.getByDisplayValue("率直に話す")).toBeInTheDocument();
  });

  it("slug が読み取り専用で表示される（入力欄ではない）", () => {
    stubAll();
    renderWithClient(<EditCommunityScene />);
    expect(screen.getByText("ai-dev")).toBeInTheDocument();
    // slug は読み取り専用なので input として操作できない
    expect(screen.queryByRole("textbox", { name: /slug/ })).not.toBeInTheDocument();
  });

  it("CommunityImageUpload（cover）が表示される", () => {
    stubAll();
    renderWithClient(<EditCommunityScene />);
    expect(screen.getByTestId("community-image-upload-cover")).toBeInTheDocument();
  });

  it("CommunityImageUpload（icon）が表示される", () => {
    stubAll();
    renderWithClient(<EditCommunityScene />);
    expect(screen.getByTestId("community-image-upload-icon")).toBeInTheDocument();
  });

  it("保存ボタンを押すと updateCommunity API が呼ばれる", async () => {
    const updateMutateAsync = vi.fn().mockResolvedValue(mockCommunity);
    stubAll({ updateMutateAsync });
    renderWithClient(<EditCommunityScene />);
    await userEvent.click(screen.getByRole("button", { name: /保存/ }));
    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled());
  });

  it("「一覧に戻る」リンクが表示される", () => {
    stubAll();
    renderWithClient(<EditCommunityScene />);
    expect(screen.getByRole("link", { name: /一覧に戻る/ })).toBeInTheDocument();
  });

  it("存在しない ID のとき「コミュニティが見つかりません」が表示される", () => {
    stubAll({ communities: [] });
    renderWithClient(<EditCommunityScene />);
    expect(screen.getByText("コミュニティが見つかりません")).toBeInTheDocument();
  });

  it("存在しない ID のとき一覧へ戻るリンクが表示される", () => {
    stubAll({ communities: [] });
    renderWithClient(<EditCommunityScene />);
    expect(screen.getByRole("link", { name: /コミュニティ一覧へ戻る/ })).toBeInTheDocument();
  });
});
