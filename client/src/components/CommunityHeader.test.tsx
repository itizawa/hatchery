import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CommunityHeader } from "./CommunityHeader";
import type { Community } from "../api/communities";
import { generateCommunityIconUrl } from "@hatchery/common";

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

  it("コミュニティ名は community-name-section コンテナ内に配置される（カバー画像と重ならない）", () => {
    render(<CommunityHeader community={baseCommunity} />);
    const section = screen.getByTestId("community-name-section");
    const heading = screen.getByRole("heading", { name: "テクノロジー" });
    expect(section).toContainElement(heading);
  });

  it("actions が指定されたときコンテナ内にレンダリングされる", () => {
    render(<CommunityHeader community={baseCommunity} actions={<button>購読</button>} />);
    expect(screen.getByRole("button", { name: "購読" })).toBeInTheDocument();
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

  it("iconUrl 未設定のとき Avatar src が bauhaus 自動生成 URL になる（#960）", () => {
    render(<CommunityHeader community={baseCommunity} />);
    const img = screen.getByRole("img", { name: "テクノロジー" });
    expect(img).toHaveAttribute("src", generateCommunityIconUrl({ id: baseCommunity.id }));
  });

  it("iconUrl 設定済みのとき Avatar src がその URL を優先する（#960）", () => {
    const iconUrl = "https://example.com/icon.png";
    render(<CommunityHeader community={{ ...baseCommunity, iconUrl }} />);
    const img = screen.getByRole("img", { name: "テクノロジー" });
    expect(img).toHaveAttribute("src", iconUrl);
  });

  describe("description 表示（#883 モバイル非表示バグ修正）", () => {
    it("description がある場合に DOM に description テキストが存在する", () => {
      render(<CommunityHeader community={baseCommunity} />);
      expect(screen.getByText("テクノロジーコミュニティ")).toBeInTheDocument();
    });

    it("description が null の場合に description テキストが DOM に存在しない", () => {
      // Community.description は string（非 nullable）だが防御的ガード（{description && ...}）の動作確認
      render(<CommunityHeader community={{ ...baseCommunity, description: null } as unknown as Community} />);
      expect(screen.queryByText("テクノロジーコミュニティ")).not.toBeInTheDocument();
    });

    it("description が空文字の場合に description テキストが DOM に存在しない", () => {
      render(<CommunityHeader community={{ ...baseCommunity, description: "" }} />);
      expect(screen.queryByText("テクノロジーコミュニティ")).not.toBeInTheDocument();
    });
  });
});
