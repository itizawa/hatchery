import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CommunityHeader } from "./CommunityHeader";
import type { Community } from "../api/communities";

const baseCommunity: Community = {
  id: "comm-1",
  slug: "technology",
  name: "テクノロジー",
  description: "テクノロジーコミュニティ",
  synopsis: undefined,
  last_slot_key: undefined,
  iconUrl: null,
  coverUrl: null,
  created_at: "2026-06-01T00:00:00Z",
};

describe("CommunityHeader（#457 Reddit 風ヘッダー）", () => {
  it("コミュニティ名を見出しとして表示する", () => {
    render(<CommunityHeader community={baseCommunity} />);
    expect(screen.getByRole("heading", { name: "テクノロジー" })).toBeInTheDocument();
  });

  it("iconUrl があればアイコン画像を表示する", () => {
    render(
      <CommunityHeader
        community={{ ...baseCommunity, iconUrl: "https://example.com/icon.png" }}
      />,
    );
    const img = screen.getByRole("img", { name: "テクノロジー" });
    expect(img).toHaveAttribute("src", "https://example.com/icon.png");
  });

  it("coverUrl があればカバー画像を背景として表示する（img 要素を持つ）", () => {
    render(
      <CommunityHeader
        community={{ ...baseCommunity, coverUrl: "https://example.com/cover.png" }}
      />,
    );
    const cover = screen.getByTestId("community-cover-image");
    expect(cover).toHaveAttribute("src", "https://example.com/cover.png");
  });

  it("画像未設定でも name のフォールバック（イニシャル）で崩れずに描画する", () => {
    render(<CommunityHeader community={baseCommunity} />);
    // 画像が無くても見出しは表示される
    expect(screen.getByRole("heading", { name: "テクノロジー" })).toBeInTheDocument();
    // カバー画像 img は存在しない
    expect(screen.queryByTestId("community-cover-image")).not.toBeInTheDocument();
  });
});
