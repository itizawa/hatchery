/**
 * AddCommunityScene のレンダリングテスト（#889）。
 * コミュニティ作成ページ（/admin/communities/new）のフォーム表示と送信動作を検証する。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type React from "react";

import { COMMUNITY_SLUG_MAX_LENGTH } from "@hatchery/common";

const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ children, to, search }: { children: React.ReactNode; to: string; search?: unknown }) => (
      <a href={search ? `${to}?${new URLSearchParams(search as Record<string, string>).toString()}` : to}>
        {children}
      </a>
    ),
  };
});

vi.mock("../api/communities.js", () => ({
  useCreateCommunity: vi.fn(),
}));

import { useCreateCommunity } from "../api/communities.js";
import { AddCommunityScene } from "./AddCommunityScene.js";

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function stubAll(opts?: { createMutateAsync?: ReturnType<typeof vi.fn> }) {
  vi.mocked(useCreateCommunity).mockReturnValue({
    mutateAsync:
      opts?.createMutateAsync ??
      vi.fn().mockResolvedValue({
        id: "new-community-id",
        slug: "test-community",
        name: "テストコミュニティ",
        description: "説明",
        generationInstruction: null,
        iconUrl: null,
        coverUrl: null,
        post_count: 0,
        created_at: new Date("2026-06-01"),
        last_post_at: null,
      }),
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useCreateCommunity>);
}

describe("AddCommunityScene（#889）", () => {
  it("ページタイトル「コミュニティを追加」が表示される", () => {
    stubAll();
    renderWithClient(<AddCommunityScene />);
    expect(screen.getByRole("heading", { name: "コミュニティを追加" })).toBeInTheDocument();
  });

  it("slug の入力欄が表示される", () => {
    stubAll();
    renderWithClient(<AddCommunityScene />);
    expect(screen.getByRole("textbox", { name: /slug（URL 識別子）/ })).toBeInTheDocument();
  });

  it("コミュニティ名・概要・生成プロンプト指示の入力欄が表示される", () => {
    stubAll();
    renderWithClient(<AddCommunityScene />);
    expect(screen.getByRole("textbox", { name: /コミュニティ名/ })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /コミュニティ概要（公開）/ })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /生成プロンプト指示/ })).toBeInTheDocument();
  });

  it("「一覧に戻る」リンクが表示される", () => {
    stubAll();
    renderWithClient(<AddCommunityScene />);
    expect(screen.getByRole("link", { name: /一覧に戻る/ })).toBeInTheDocument();
  });

  it("送信すると createCommunity API が呼ばれる", async () => {
    const createMutateAsync = vi.fn().mockResolvedValue({
      id: "new-id",
      slug: "tech-news",
      name: "テックニュース",
      description: "説明",
      generationInstruction: null,
      iconUrl: null,
      coverUrl: null,
      post_count: 0,
      created_at: new Date("2026-06-01"),
      last_post_at: null,
    });
    stubAll({ createMutateAsync });

    renderWithClient(<AddCommunityScene />);
    await userEvent.type(screen.getByRole("textbox", { name: /slug（URL 識別子）/ }), "tech-news");
    await userEvent.type(screen.getByRole("textbox", { name: /コミュニティ名/ }), "テックニュース");
    await userEvent.type(screen.getByRole("textbox", { name: /コミュニティ概要（公開）/ }), "最新技術");
    await userEvent.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() =>
      expect(createMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ slug: "tech-news", name: "テックニュース" }),
      ),
    );
  });

  it("送信成功後に編集ページへ遷移する", async () => {
    const createMutateAsync = vi.fn().mockResolvedValue({
      id: "new-id",
      slug: "tech-news",
      name: "テックニュース",
      description: "説明",
      generationInstruction: null,
      iconUrl: null,
      coverUrl: null,
      post_count: 0,
      created_at: new Date("2026-06-01"),
      last_post_at: null,
    });
    stubAll({ createMutateAsync });

    renderWithClient(<AddCommunityScene />);
    await userEvent.type(screen.getByRole("textbox", { name: /slug（URL 識別子）/ }), "tech-news");
    await userEvent.type(screen.getByRole("textbox", { name: /コミュニティ名/ }), "テックニュース");
    await userEvent.type(screen.getByRole("textbox", { name: /コミュニティ概要（公開）/ }), "最新技術");
    await userEvent.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: "/admin/communities/$id/edit" }),
      ),
    );
  });

  it("slug フィールドに COMMUNITY_SLUG_MAX_LENGTH の maxLength が設定されている", () => {
    stubAll();
    renderWithClient(<AddCommunityScene />);
    const slugInput = screen.getByRole("textbox", { name: /slug（URL 識別子）/ });
    expect(slugInput).toHaveAttribute("maxlength", String(COMMUNITY_SLUG_MAX_LENGTH));
  });
});
