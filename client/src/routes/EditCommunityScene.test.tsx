/**
 * EditCommunityScene のレンダリングテスト（#889）。
 * コミュニティ編集ページ（/admin/communities/:id/edit）のフォーム表示と送信動作を検証する。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type React from "react";

import type { AdminCommunity } from "@hatchery/common";

const mockCommunity: AdminCommunity = {
  id: "community-abc",
  slug: "ai-dev",
  name: "AI 開発者の集い",
  description: "AI ワーカーが語るコミュニティ",
  generationInstruction: "率直に話す。",
  iconUrl: null,
  coverUrl: null,
  post_count: 3,
  created_at: new Date("2026-06-01"),
  last_post_at: null,
};

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useParams: () => ({ id: "community-abc" }),
    Link: ({ children, to, search }: { children: React.ReactNode; to: string; search?: unknown }) => (
      <a href={search ? `${to}?${new URLSearchParams(search as Record<string, string>).toString()}` : to}>
        {children}
      </a>
    ),
  };
});

vi.mock("../api/communities.js", () => ({
  useAdminCommunityById: vi.fn(),
  useUpdateCommunity: vi.fn(),
}));

vi.mock("../components/CommunityImageUpload.js", () => ({
  CommunityImageUpload: ({ kind }: { kind: string }) => (
    <div data-testid={`community-image-upload-${kind}`}>CommunityImageUpload: {kind}</div>
  ),
}));

import { useAdminCommunityById, useUpdateCommunity } from "../api/communities.js";
import { EditCommunityScene } from "./EditCommunityScene.js";

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function stubAll(opts?: {
  community?: AdminCommunity | null;
  updateMutateAsync?: ReturnType<typeof vi.fn>;
}) {
  const community = opts?.community === undefined ? mockCommunity : opts.community;

  if (community === null) {
    vi.mocked(useAdminCommunityById).mockImplementation(() => {
      throw new Error("CommunityNotFound");
    });
  } else {
    vi.mocked(useAdminCommunityById).mockReturnValue({
      data: community,
    } as unknown as ReturnType<typeof useAdminCommunityById>);
  }

  vi.mocked(useUpdateCommunity).mockReturnValue({
    mutateAsync: opts?.updateMutateAsync ?? vi.fn().mockResolvedValue(community),
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

  it("nameヽdescriptionヽgenerationInstruction の入力欄が既存値で初期化される", () => {
    stubAll();
    renderWithClient(<EditCommunityScene />);
    expect(screen.getByRole("textbox", { name: /コミュニティ名/ })).toHaveValue("AI 開発者の集い");
    expect(screen.getByRole("textbox", { name: /コミュニティ概要（公開）/ })).toHaveValue(
      "AI ワーカーが語るコミュニティ",
    );
    expect(screen.getByRole("textbox", { name: /生成プロンプト指示/ })).toHaveValue("率直に話す。");
  });

  it("CommunityImageUpload（cover / icon）が表示される", () => {
    stubAll();
    renderWithClient(<EditCommunityScene />);
    expect(screen.getByTestId("community-image-upload-cover")).toBeInTheDocument();
    expect(screen.getByTestId("community-image-upload-icon")).toBeInTheDocument();
  });

  it("「一覧に戻る」リンクが表示される", () => {
    stubAll();
    renderWithClient(<EditCommunityScene />);
    expect(screen.getByRole("link", { name: /一覧に戻る/ })).toBeInTheDocument();
  });

  it("送信すると updateCommunity API が呼ばれる", async () => {
    const updateMutateAsync = vi.fn().mockResolvedValue(mockCommunity);
    stubAll({ updateMutateAsync });

    renderWithClient(<EditCommunityScene />);
    const nameInput = screen.getByRole("textbox", { name: /コミュニティ名/ });
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "新しい名前");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(updateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ id: "community-abc" }),
      ),
    );
  });

  it("存在しない ID のときは「コミュニティが見つかりません」が表示される", () => {
    stubAll({ community: null });
    renderWithClient(<EditCommunityScene />);
    expect(screen.getByText("コミュニティが見つかりません")).toBeInTheDocument();
  });
});
