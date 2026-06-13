import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SidebarCommunitySection } from "./SidebarCommunitySection";
import type { Community } from "../api/communities";
import type React from "react";

const mockCommunities: Community[] = [
  {
    id: "community-1",
    slug: "ai-dev",
    name: "AI 開発者の集い",
    description: "AI ワーカーが日常を語る community",
    synopsis: undefined,
    last_slot_key: undefined,
    created_at: "2026-06-01T00:00:00Z",
  },
  {
    id: "community-2",
    slug: "coding-life",
    name: "コーディング日常",
    description: "コーディングの日常を語る",
    synopsis: undefined,
    last_slot_key: undefined,
    created_at: "2026-06-02T00:00:00Z",
  },
];

// RouterProviderとQueryClientを提供するシンプルなラッパー
function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  qc.setQueryData(["communities"], mockCommunities);

  return (
    <QueryClientProvider client={qc}>
      {children}
    </QueryClientProvider>
  );
}

// RouterProvider なしでは RouterLink がエラーになるため
// SidebarCommunitySection を RouterProvider の外では使えない。
// そのためここでは RouterLink を使わないモック環境でテストする。
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string; params?: unknown }) => (
      <a href={to}>{children}</a>
    ),
  };
});

describe("SidebarCommunitySection", () => {
  it("コミュニティ一覧が表示名で表示される", async () => {
    render(<SidebarCommunitySection />, { wrapper: Wrapper });
    expect(await screen.findByText("AI 開発者の集い")).toBeInTheDocument();
    expect(screen.getByText("コーディング日常")).toBeInTheDocument();
  });

  it("r/ プレフィックス付き slug は表示されない", async () => {
    render(<SidebarCommunitySection />, { wrapper: Wrapper });
    await screen.findByText("AI 開発者の集い");
    expect(screen.queryByText("r/ai-dev")).not.toBeInTheDocument();
    expect(screen.queryByText("r/coding-life")).not.toBeInTheDocument();
  });

  it("「探す」リンクが表示される", async () => {
    render(<SidebarCommunitySection />, { wrapper: Wrapper });
    expect(await screen.findByText("探す")).toBeInTheDocument();
  });

  it("「コミュニティ」セクションのラベルが表示される", () => {
    render(<SidebarCommunitySection />, { wrapper: Wrapper });
    expect(screen.getByText("コミュニティ")).toBeInTheDocument();
  });

  it("初期状態は展開で、トグルの aria-expanded が true・本体が表示される", async () => {
    render(<SidebarCommunitySection />, { wrapper: Wrapper });
    const toggle = screen.getByRole("button", { name: /コミュニティ/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByText("AI 開発者の集い")).toBeInTheDocument();
    expect(screen.getByText("探す")).toBeInTheDocument();
  });

  it("見出しクリックで折りたたまれ、本体が非マウントになり aria-expanded が false になる", async () => {
    const user = userEvent.setup();
    render(<SidebarCommunitySection />, { wrapper: Wrapper });
    await screen.findByText("AI 開発者の集い");
    const toggle = screen.getByRole("button", { name: /コミュニティ/ });

    await user.click(toggle);

    // MUI Collapse(unmountOnExit) はトランジション完了後に子を DOM から外す
    await waitFor(() => {
      expect(screen.queryByText("AI 開発者の集い")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("コーディング日常")).not.toBeInTheDocument();
    expect(screen.queryByText("探す")).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("折りたたみ後に再クリックすると再展開し、本体が再表示され aria-expanded が true に戻る", async () => {
    const user = userEvent.setup();
    render(<SidebarCommunitySection />, { wrapper: Wrapper });
    await screen.findByText("AI 開発者の集い");
    const toggle = screen.getByRole("button", { name: /コミュニティ/ });

    await user.click(toggle);
    await waitFor(() => {
      expect(screen.queryByText("AI 開発者の集い")).not.toBeInTheDocument();
    });

    await user.click(toggle);

    expect(await screen.findByText("AI 開発者の集い")).toBeInTheDocument();
    expect(screen.getByText("探す")).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });
});
