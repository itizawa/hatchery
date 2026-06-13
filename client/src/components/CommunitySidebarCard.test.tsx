import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CommunitySidebarCard } from "./CommunitySidebarCard";
import type { Community } from "../api/communities";
import type React from "react";

const mockCommunity: Community = {
  id: "community-1",
  slug: "ai-dev",
  name: "AI 開発者の集い",
  description: "AI ワーカーが日常を語る community",
  synopsis: undefined,
  last_slot_key: undefined,
  created_at: "2026-06-01T00:00:00Z",
};

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string; params?: unknown }) => (
      <a href={to}>{children}</a>
    ),
  };
});

const baseProps = {
  community: mockCommunity,
  shareUrl: "https://example.com/communities/ai-dev",
  shareTitle: "AI 開発者の集い",
  showSubscribe: true,
  subscribed: false,
  subscriptionPending: false,
  onSubscribe: vi.fn(),
  onUnsubscribe: vi.fn(),
};

describe("CommunitySidebarCard", () => {
  it("コミュニティ名を表示する", () => {
    render(<CommunitySidebarCard {...baseProps} />);
    expect(screen.getByText("AI 開発者の集い")).toBeInTheDocument();
  });

  it("nameLink=true のときコミュニティ名がコミュニティページへのリンクになる", () => {
    render(<CommunitySidebarCard {...baseProps} nameLink />);
    const link = screen.getByRole("link", { name: "AI 開発者の集い" });
    expect(link).toHaveAttribute("href", "/communities/$slug");
  });

  it("nameLink を指定しないときコミュニティ名はリンクにならない", () => {
    render(<CommunitySidebarCard {...baseProps} />);
    expect(screen.queryByRole("link", { name: "AI 開発者の集い" })).not.toBeInTheDocument();
  });

  it("コミュニティの説明を表示する", () => {
    render(<CommunitySidebarCard {...baseProps} />);
    expect(screen.getByText("AI ワーカーが日常を語る community")).toBeInTheDocument();
  });

  it("説明が空文字の場合は描画しない", () => {
    const { container } = render(
      <CommunitySidebarCard {...baseProps} community={{ ...mockCommunity, description: "" }} />,
    );
    expect(container).not.toHaveTextContent("AI ワーカーが日常を語る community");
  });

  it("作成日を「YYYY年M月D日 作成」フォーマットで表示する", () => {
    render(<CommunitySidebarCard {...baseProps} />);
    expect(screen.getByText("2026年6月1日 作成")).toBeInTheDocument();
  });

  it("created_at が undefined のとき「NaN年...」を出さず作成日行を描画しない（#477）", () => {
    render(
      <CommunitySidebarCard
        {...baseProps}
        community={{ ...mockCommunity, created_at: undefined as unknown as string }}
      />,
    );
    expect(screen.queryByText(/作成/)).not.toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it("created_at が不正日付のとき「NaN年...」を出さず作成日行を描画しない（#477）", () => {
    render(
      <CommunitySidebarCard
        {...baseProps}
        community={{ ...mockCommunity, created_at: "not-a-date" }}
      />,
    );
    expect(screen.queryByText(/作成/)).not.toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it("showSubscribe=true のとき購読ボタンを表示し、クリックで onSubscribe が呼ばれる", async () => {
    const onSubscribe = vi.fn();
    render(<CommunitySidebarCard {...baseProps} onSubscribe={onSubscribe} />);
    await userEvent.click(screen.getByRole("button", { name: "購読する" }));
    expect(onSubscribe).toHaveBeenCalledTimes(1);
  });

  it("subscribed=true のとき購読解除ボタンを表示し、クリックで onUnsubscribe が呼ばれる", async () => {
    const onUnsubscribe = vi.fn();
    render(<CommunitySidebarCard {...baseProps} subscribed onUnsubscribe={onUnsubscribe} />);
    await userEvent.click(screen.getByRole("button", { name: "購読解除" }));
    expect(onUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it("showSubscribe=false のとき購読ボタンを表示しない", () => {
    render(<CommunitySidebarCard {...baseProps} showSubscribe={false} />);
    expect(screen.queryByRole("button", { name: "購読する" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "購読解除" })).not.toBeInTheDocument();
  });

  it("シェアボタンを表示する", () => {
    render(<CommunitySidebarCard {...baseProps} />);
    expect(screen.getByRole("button", { name: /共有/i })).toBeInTheDocument();
  });

  it("iconUrl が設定されているときアイコン画像を表示する（#457）", () => {
    render(
      <CommunitySidebarCard
        {...baseProps}
        community={{ ...mockCommunity, iconUrl: "https://example.com/icon.png" }}
      />,
    );
    const img = screen.getByRole("img", { name: "AI 開発者の集い" });
    expect(img).toHaveAttribute("src", "https://example.com/icon.png");
  });

  it("iconUrl 未設定でもイニシャルのフォールバックで崩れずに表示する（#457）", () => {
    render(<CommunitySidebarCard {...baseProps} />);
    expect(screen.getByRole("heading", { name: "AI 開発者の集い" })).toBeInTheDocument();
  });

  it("children を追加セクションとして描画する", () => {
    render(
      <CommunitySidebarCard {...baseProps}>
        <div>最近投稿したワーカー</div>
      </CommunitySidebarCard>,
    );
    expect(screen.getByText("最近投稿したワーカー")).toBeInTheDocument();
  });
});
