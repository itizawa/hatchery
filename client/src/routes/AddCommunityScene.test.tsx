/**
 * AddCommunityScene のレンダリングテスト（#889）。
 * コミュニティ作成ページ（/admin/communities/new）のフォーム表示と送信動作を検証する。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type React from "react";

import {
  COMMUNITY_DESCRIPTION_MAX_LENGTH,
  COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH,
  COMMUNITY_NAME_MAX_LENGTH,
  COMMUNITY_SLUG_MAX_LENGTH,
} from "@hatchery/common";

const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ children, to, search }: { children: React.ReactNode; to: string; search?: unknown }) => (
      <a href={search ? `${to}?${new URLSearchParams(search as Record<string, string>).toString()}` : to}>{children}</a>
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

function stubAll(opts?: {
  mutateAsync?: ReturnType<typeof vi.fn>;
  isPending?: boolean;
  isError?: boolean;
  error?: Error | null;
}) {
  vi.mocked(useCreateCommunity).mockReturnValue({
    mutateAsync: opts?.mutateAsync ?? vi.fn().mockResolvedValue({ id: "new-community-id", slug: "test-comm", name: "テスト" }),
    isPending: opts?.isPending ?? false,
    isError: opts?.isError ?? false,
    error: opts?.error ?? null,
    reset: vi.fn(),
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

  it("コミュニティ名の入力欄が表示される", () => {
    stubAll();
    renderWithClient(<AddCommunityScene />);
    expect(screen.getByRole("textbox", { name: /コミュニティ名/ })).toBeInTheDocument();
  });

  it("概要（公開）の入力欄が表示される", () => {
    stubAll();
    renderWithClient(<AddCommunityScene />);
    expect(screen.getByRole("textbox", { name: /コミュニティ概要（公開）/ })).toBeInTheDocument();
  });

  it("生成プロンプト指示の入力欄が表示される", () => {
    stubAll();
    renderWithClient(<AddCommunityScene />);
    expect(screen.getByRole("textbox", { name: /生成プロンプト指示/ })).toBeInTheDocument();
  });

  it("「一覧に戻る」リンクが表示される", () => {
    stubAll();
    renderWithClient(<AddCommunityScene />);
    expect(screen.getByRole("link", { name: /一覧に戻る/ })).toBeInTheDocument();
  });

  it("各入力に Zod .max() と整合する maxLength が設定されている（#91）", () => {
    stubAll();
    renderWithClient(<AddCommunityScene />);
    expect(screen.getByRole("textbox", { name: /slug（URL 識別子）/ })).toHaveAttribute(
      "maxlength",
      String(COMMUNITY_SLUG_MAX_LENGTH),
    );
    expect(screen.getByRole("textbox", { name: /コミュニティ名/ })).toHaveAttribute(
      "maxlength",
      String(COMMUNITY_NAME_MAX_LENGTH),
    );
    expect(screen.getByRole("textbox", { name: /コミュニティ概要（公開）/ })).toHaveAttribute(
      "maxlength",
      String(COMMUNITY_DESCRIPTION_MAX_LENGTH),
    );
    expect(screen.getByRole("textbox", { name: /生成プロンプト指示/ })).toHaveAttribute(
      "maxlength",
      String(COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH),
    );
  });

  it("必須項目が空のまま送信するとバリデーションエラーが表示される", async () => {
    stubAll();
    renderWithClient(<AddCommunityScene />);
    // validateAllFields("submit") はマイクロタスクでバリデーターを非同期実行するため、
    // userEvent.click() 内の act() 外で store 更新が起き React 19 の
    // useSyncExternalStore がテスト環境でコミットされない問題を回避する。
    // 各フィールドを一度入力→削除して onChange バリデーターを act() 内で同期発火し、
    // エラーを DOM に反映させてから送信する。
    await userEvent.type(screen.getByRole("textbox", { name: /slug（URL 識別子）/ }), "x{Backspace}");
    await userEvent.type(screen.getByRole("textbox", { name: /コミュニティ名/ }), "x{Backspace}");
    await userEvent.type(screen.getByRole("textbox", { name: /コミュニティ概要（公開）/ }), "x{Backspace}");
    await userEvent.click(screen.getByRole("button", { name: "作成" }));
    expect(screen.getByText("slug は必須です")).toBeInTheDocument();
    expect(screen.getByText("コミュニティ名は必須です")).toBeInTheDocument();
    expect(screen.getByText("作風の説明は必須です")).toBeInTheDocument();
  });

  it("slug の形式が不正なとき形式エラーが表示される", async () => {
    stubAll();
    renderWithClient(<AddCommunityScene />);
    await userEvent.type(screen.getByRole("textbox", { name: /slug（URL 識別子）/ }), "Invalid_Slug");
    await userEvent.type(screen.getByRole("textbox", { name: /コミュニティ名/ }), "テスト");
    await userEvent.type(screen.getByRole("textbox", { name: /コミュニティ概要（公開）/ }), "テスト説明");
    await userEvent.click(screen.getByRole("button", { name: "作成" }));
    expect(
      await screen.findByText("slug は小文字英数字とハイフンのみ（先頭末尾は英数字）"),
    ).toBeInTheDocument();
  });

  it("有効な入力で送信すると createCommunity API が正しい body で呼ばれる", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: "new-id", slug: "tech-news", name: "テック" });
    stubAll({ mutateAsync });
    renderWithClient(<AddCommunityScene />);
    await userEvent.type(screen.getByRole("textbox", { name: /slug（URL 識別子）/ }), "tech-news");
    await userEvent.type(screen.getByRole("textbox", { name: /コミュニティ名/ }), "テックニュース");
    await userEvent.type(screen.getByRole("textbox", { name: /コミュニティ概要（公開）/ }), "最新技術の話題");
    await userEvent.click(screen.getByRole("button", { name: "作成" }));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ slug: "tech-news", name: "テックニュース" }),
      ),
    );
  });

  it("送信成功後に編集ページへ遷移する", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: "new-id", slug: "tech-news", name: "テック" });
    stubAll({ mutateAsync });
    renderWithClient(<AddCommunityScene />);
    await userEvent.type(screen.getByRole("textbox", { name: /slug（URL 識別子）/ }), "tech-news");
    await userEvent.type(screen.getByRole("textbox", { name: /コミュニティ名/ }), "テックニュース");
    await userEvent.type(screen.getByRole("textbox", { name: /コミュニティ概要（公開）/ }), "最新技術の話題");
    await userEvent.click(screen.getByRole("button", { name: "作成" }));
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: "/admin/communities/$communityId/edit" }),
      ),
    );
  });

  it("409 エラー時に slug 重複エラーメッセージが表示される", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error("CommunitySlugAlreadyExists"));
    stubAll({ mutateAsync });
    renderWithClient(<AddCommunityScene />);
    await userEvent.type(screen.getByRole("textbox", { name: /slug（URL 識別子）/ }), "ai-dev");
    await userEvent.type(screen.getByRole("textbox", { name: /コミュニティ名/ }), "AI 開発者");
    await userEvent.type(screen.getByRole("textbox", { name: /コミュニティ概要（公開）/ }), "テスト");
    await userEvent.click(screen.getByRole("button", { name: "作成" }));
    expect(await screen.findByText("この slug はすでに使用されています")).toBeInTheDocument();
  });
});
