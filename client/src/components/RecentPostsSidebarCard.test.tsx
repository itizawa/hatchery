import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type React from "react";

import { RecentPostsSidebarCard } from "./RecentPostsSidebarCard.js";
import type { Post } from "../api/posts.js";
import { SLACK_COLORS } from "../theme.js";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to,
      params,
    }: {
      children: React.ReactNode;
      to: string;
      params?: Record<string, string>;
    }) => {
      const href = params
        ? Object.entries(params).reduce(
            // eslint-disable-next-line max-params
            (t, [k, v]) => t.replace(`$${k}`, v),
            to,
          )
        : to;
      return <a href={href}>{children}</a>;
    },
  };
});

const makePost = (overrides: Partial<Post> = {}): Post =>
  ({
    id: "post-1",
    title: "テスト投稿タイトル",
    text: "テスト投稿の本文内容です。",
    author: "worker-1",
    author_worker: undefined,
    community_id: "community-1",
    score: 5,
    comment_count: 2,
    slot_key: "2026-06-01T00:00",
    seq: 1,
    created_at: new Date("2026-06-01T00:00:00Z"),
    my_vote: null,
    ...overrides,
  }) as Post;

const mockCommunityById = new Map([
  ["community-1", { slug: "ai-dev", name: "AI 開発者" }],
  ["community-2", { slug: "tech-talk", name: "Tech Talk" }],
]);

describe("RecentPostsSidebarCard", () => {
  it("投稿タイトルを表示する", () => {
    const posts = [makePost()];
    render(<RecentPostsSidebarCard posts={posts} communityById={mockCommunityById} />);
    expect(screen.getByText("テスト投稿タイトル")).toBeInTheDocument();
  });

  it("各投稿エントリは /posts/$postId へのリンクを持つ", () => {
    const posts = [makePost({ id: "post-abc" })];
    render(<RecentPostsSidebarCard posts={posts} communityById={mockCommunityById} />);
    const links = screen.getAllByRole("link");
    const postLinks = links.filter((l) => l.getAttribute("href")?.includes("post-abc"));
    expect(postLinks.length).toBeGreaterThan(0);
  });

  it("コミュニティ名は /communities/$slug へのリンクである", () => {
    const posts = [makePost({ community_id: "community-1" })];
    render(<RecentPostsSidebarCard posts={posts} communityById={mockCommunityById} />);
    const communityLink = screen.getByRole("link", { name: "AI 開発者" });
    expect(communityLink).toHaveAttribute("href", "/communities/ai-dev");
  });

  it("投稿が 0 件のとき空状態メッセージが表示される", () => {
    render(<RecentPostsSidebarCard posts={[]} communityById={mockCommunityById} />);
    expect(screen.getByText(/新着投稿がありません/)).toBeInTheDocument();
  });

  it("投票ボタンが表示されない（読み取り専用）", () => {
    const posts = [makePost()];
    render(<RecentPostsSidebarCard posts={posts} communityById={mockCommunityById} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("複数の投稿を表示する", () => {
    const posts = [
      makePost({ id: "p1", title: "投稿A" }),
      makePost({ id: "p2", title: "投稿B" }),
    ];
    render(<RecentPostsSidebarCard posts={posts} communityById={mockCommunityById} />);
    expect(screen.getByText("投稿A")).toBeInTheDocument();
    expect(screen.getByText("投稿B")).toBeInTheDocument();
  });

  it("community_id に対応するコミュニティが communityById にない場合もクラッシュしない", () => {
    const posts = [makePost({ community_id: "unknown-community" })];
    expect(() =>
      render(<RecentPostsSidebarCard posts={posts} communityById={mockCommunityById} />),
    ).not.toThrow();
  });

  it("本文冒頭を表示する", () => {
    const posts = [makePost({ text: "本文の冒頭テキストです。" })];
    render(<RecentPostsSidebarCard posts={posts} communityById={mockCommunityById} />);
    expect(screen.getByText("本文の冒頭テキストです。")).toBeInTheDocument();
  });

  it("各投稿アイテムに薄いグレー背景色が設定される", () => {
    const posts = [makePost({ title: "スタイル確認用投稿" })];
    render(<RecentPostsSidebarCard posts={posts} communityById={mockCommunityById} />);
    const item = screen.getByText("スタイル確認用投稿").closest("li");
    expect(item).toHaveStyle({ backgroundColor: SLACK_COLORS.mainBackground });
  });

  it("各投稿アイテムの角丸が16px未満で設定される", () => {
    const posts = [makePost({ title: "角丸確認用投稿" })];
    render(<RecentPostsSidebarCard posts={posts} communityById={mockCommunityById} />);
    const item = screen.getByText("角丸確認用投稿").closest("li");
    const borderRadius = parseFloat(getComputedStyle(item as Element).borderRadius);
    expect(borderRadius).toBeGreaterThan(0);
    expect(borderRadius).toBeLessThan(16);
  });
});
