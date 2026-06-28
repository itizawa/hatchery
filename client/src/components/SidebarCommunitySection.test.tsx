import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SIDEBAR_ICON_SIZE, SidebarCommunitySection } from "./SidebarCommunitySection";
import type { Community } from "../api/communities";
import { generateCommunityIconUrl } from "@hatchery/common";
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
    iconUrl: "https://example.com/icon1.png",
  },
  {
    id: "community-2",
    slug: "coding-life",
    name: "コーディング日常",
    description: "コーディングの日常を語る",
    synopsis: undefined,
    last_slot_key: undefined,
    created_at: "2026-06-02T00:00:00Z",
    iconUrl: null,
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

describe("SIDEBAR_ICON_SIZE", () => {
  it("SIDEBAR_ICON_SIZE が 20 で export されている", () => {
    expect(SIDEBAR_ICON_SIZE).toBe(20);
  });
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

  it("iconUrl がある場合、img タグに src が設定される", async () => {
    render(<SidebarCommunitySection />, { wrapper: Wrapper });
    await screen.findByText("AI 開発者の集い");
    const img = screen.getByRole("img", { name: "AI 開発者の集い" });
    expect(img).toHaveAttribute("src", "https://example.com/icon1.png");
  });

  it("iconUrl が null の場合、Avatar src が bauhaus 自動生成 URL になる（イニシャル表示ではなく img が表示される）", async () => {
    render(<SidebarCommunitySection />, { wrapper: Wrapper });
    await screen.findByText("AI 開発者の集い");
    // iconUrl: null のコミュニティは自動生成 URL の img として表示される（#960）
    const img = screen.getByRole("img", { name: "コーディング日常" });
    expect(img).toHaveAttribute("src", generateCommunityIconUrl({ id: "community-2" }));
  });

  it("コミュニティ Avatar が SIDEBAR_ICON_SIZE と同じ width/height の style で表示される（iconUrl なし）", async () => {
    render(<SidebarCommunitySection />, { wrapper: Wrapper });
    await screen.findByText("AI 開発者の集い");
    // iconUrl なし（コーディング日常）の Avatar: img role で取得しコンテナのサイズを確認
    const img = screen.getByRole("img", { name: "コーディング日常" });
    const avatarRoot = img.closest(".MuiAvatar-root") as HTMLElement | null;
    expect(avatarRoot).not.toBeNull();
    expect(avatarRoot).toHaveStyle({ width: `${SIDEBAR_ICON_SIZE}px`, height: `${SIDEBAR_ICON_SIZE}px` });
  });

  it("コミュニティ Avatar が SIDEBAR_ICON_SIZE と同じ width/height の style で表示される（iconUrl あり）", async () => {
    render(<SidebarCommunitySection />, { wrapper: Wrapper });
    await screen.findByText("AI 開発者の集い");
    // iconUrl がある Avatar（AI 開発者の集い）のコンテナを取得
    const img = screen.getByRole("img", { name: "AI 開発者の集い" });
    const avatarRoot = img.closest(".MuiAvatar-root") as HTMLElement | null;
    expect(avatarRoot).not.toBeNull();
    expect(avatarRoot).toHaveStyle({ width: `${SIDEBAR_ICON_SIZE}px`, height: `${SIDEBAR_ICON_SIZE}px` });
  });

  it("「探す」リンクのアイコンが MuiListItemIcon-root クラスを持つ要素でレンダリングされる (#732)", async () => {
    const { container } = render(<SidebarCommunitySection />, { wrapper: Wrapper });
    await screen.findByText("探す");
    // 「探す」リンク（a[href="/communities"]）を取得
    const exploreLink = screen.getByRole("link", { name: /探す/ });
    // ListItemButton の最初の子要素（アイコンラッパー）が MuiListItemIcon-root クラスを持つ
    const firstChild = exploreLink.firstElementChild;
    expect(firstChild?.classList.contains("MuiListItemIcon-root")).toBe(true);
    // 追加確認: コンテナ全体で MuiListItemIcon-root が存在すること
    const allListItemIcons = container.querySelectorAll(".MuiListItemIcon-root");
    const exploreIconWrapper = Array.from(allListItemIcons).find(
      (el) => el.closest("a[href='/communities']") === el.closest("a"),
    );
    expect(exploreIconWrapper).toBeDefined();
  });

  it("iconUrl 未設定のコミュニティの Avatar src が bauhaus 自動生成 URL になる（#960）", async () => {
    render(<SidebarCommunitySection />, { wrapper: Wrapper });
    await screen.findByText("AI 開発者の集い");
    // community-2（iconUrl: null）の Avatar src を確認
    const img = screen.getByRole("img", { name: "コーディング日常" });
    expect(img).toHaveAttribute("src", generateCommunityIconUrl({ id: "community-2" }));
  });

  it("iconUrl 設定済みのコミュニティの Avatar src はその URL を優先する（#960）", async () => {
    render(<SidebarCommunitySection />, { wrapper: Wrapper });
    await screen.findByText("AI 開発者の集い");
    // community-1（iconUrl: "https://example.com/icon1.png"）の Avatar src を確認
    const img = screen.getByRole("img", { name: "AI 開発者の集い" });
    expect(img).toHaveAttribute("src", "https://example.com/icon1.png");
  });
});
