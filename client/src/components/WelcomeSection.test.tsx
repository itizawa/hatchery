import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type React from "react";

import { WelcomeSection } from "./WelcomeSection.js";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string; params?: unknown }) => (
      <a href={String(to)}>{children}</a>
    ),
  };
});

const communities = [
  {
    id: "c-1",
    slug: "ai-dev",
    name: "AI 開発者の集い",
    description: "AI ワーカーが語る",
    synopsis: undefined,
    last_slot_key: undefined,
    created_at: "2026-06-01T00:00:00Z",
  },
  {
    id: "c-2",
    slug: "zenn-talk",
    name: "Zenn 感想部",
    description: "記事の感想を語る",
    synopsis: undefined,
    last_slot_key: undefined,
    created_at: "2026-06-01T00:00:00Z",
  },
];

describe("WelcomeSection (#482)", () => {
  it("「Hatchery へようこそ」見出しが表示される", () => {
    render(<WelcomeSection communities={[]} />);
    expect(screen.getByRole("heading", { name: /Hatchery へようこそ/ })).toBeInTheDocument();
  });

  it("コミュニティ一覧が表示される", () => {
    render(<WelcomeSection communities={communities} />);
    expect(screen.getByText("AI 開発者の集い")).toBeInTheDocument();
    expect(screen.getByText("Zenn 感想部")).toBeInTheDocument();
  });

  it("コミュニティ名が /communities/$slug へのリンクになっている", () => {
    render(<WelcomeSection communities={communities} />);
    const link = screen.getByRole("link", { name: "AI 開発者の集い" });
    expect(link).toHaveAttribute("href", "/communities/ai-dev");
  });

  it("「コミュニティを探す」ボタンが表示される", () => {
    render(<WelcomeSection communities={[]} />);
    expect(screen.getByRole("link", { name: /コミュニティを探す/ })).toBeInTheDocument();
  });

  it("communities が空でも正常に表示される", () => {
    render(<WelcomeSection communities={[]} />);
    expect(screen.getByRole("heading", { name: /Hatchery へようこそ/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /コミュニティを探す/ })).toBeInTheDocument();
  });
});

describe("WelcomeSection コミュニティチップの選出（#1083）", () => {
  // API は created_at 昇順（古い順）で返す想定。9件用意し、表示上限(8件)を超えさせる。
  const manyCommunities = Array.from({ length: 9 }, (_, i) => ({
    id: `c-${i}`,
    slug: `community-${i}`,
    name: `コミュニティ${i}`,
    description: "",
    synopsis: undefined,
    last_slot_key: undefined,
    created_at: `2026-06-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
  }));

  it("コミュニティが表示上限を超える場合、最も新しいコミュニティがチップ一覧に表示される", () => {
    render(<WelcomeSection communities={manyCommunities} />);
    // 9件中、最後(index=8)が created_at 最新の新設コミュニティ
    expect(screen.getByText("コミュニティ8")).toBeInTheDocument();
  });

  it("コミュニティが表示上限を超える場合、表示されるチップ数は上限件数を超えない", () => {
    render(<WelcomeSection communities={manyCommunities} />);
    const chips = manyCommunities.filter((c) =>
      screen.queryByText(c.name) !== null,
    );
    expect(chips.length).toBeLessThanOrEqual(8);
  });
});
