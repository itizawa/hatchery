import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type React from "react";

import { TrendingSidebarCard } from "./TrendingSidebarCard.js";
import type { TrendingItem } from "@hatchery/common";
import { SLACK_COLORS } from "../theme.js";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to,
      params,
      hash,
    }: {
      children: React.ReactNode;
      to: string;
      params?: Record<string, string>;
      hash?: string;
    }) => {
      const path = params
        ? Object.entries(params).reduce(
            // eslint-disable-next-line max-params
            (t, [k, v]) => t.replace(`$${k}`, v),
            to,
          )
        : to;
      const href = hash ? `${path}#${hash}` : path;
      return <a href={href}>{children}</a>;
    },
  };
});

const makePostItem = (overrides: Partial<TrendingItem> = {}): TrendingItem =>
  ({
    type: "post",
    id: "post-1",
    post_id: "post-1",
    excerpt: "テスト投稿の本文冒頭です",
    community_id: "community-1",
    community_slug: "ai-dev",
    net_score: 5,
    created_at: "2026-07-01T09:00:00.000Z",
    ...overrides,
  }) as TrendingItem;

const makeCommentItem = (overrides: Partial<TrendingItem> = {}): TrendingItem =>
  ({
    type: "comment",
    id: "comment-1",
    post_id: "post-1",
    excerpt: "テストコメントの本文冒頭です",
    community_id: "community-1",
    community_slug: "ai-dev",
    net_score: -2,
    created_at: "2026-07-01T09:00:00.000Z",
    ...overrides,
  }) as TrendingItem;

describe("TrendingSidebarCard（#1065）", () => {
  it("post アイテムの excerpt を表示する", () => {
    render(<TrendingSidebarCard items={[makePostItem()]} />);
    expect(screen.getByText("テスト投稿の本文冒頭です")).toBeInTheDocument();
  });

  it("comment アイテムの excerpt を表示する", () => {
    render(<TrendingSidebarCard items={[makeCommentItem()]} />);
    expect(screen.getByText("テストコメントの本文冒頭です")).toBeInTheDocument();
  });

  it("post アイテムは /posts/$postId へのリンクで hash を持たない", () => {
    render(<TrendingSidebarCard items={[makePostItem({ post_id: "post-abc" })]} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/posts/post-abc");
  });

  it("comment アイテムは /posts/$postId へのリンクに #comment-<id> の hash を持つ", () => {
    render(
      <TrendingSidebarCard items={[makeCommentItem({ id: "comment-xyz", post_id: "post-abc" })]} />,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/posts/post-abc#comment-comment-xyz");
  });

  it("net_score が 0 以上のとき + プレフィックス付きで表示される", () => {
    render(<TrendingSidebarCard items={[makePostItem({ net_score: 3 })]} />);
    expect(screen.getByText("+3")).toBeInTheDocument();
  });

  it("net_score が負値のとき符号付きで表示される", () => {
    render(<TrendingSidebarCard items={[makeCommentItem({ net_score: -4 })]} />);
    expect(screen.getByText("-4")).toBeInTheDocument();
  });

  it("複数のアイテムを表示する", () => {
    render(
      <TrendingSidebarCard
        items={[
          makePostItem({ id: "p1", excerpt: "投稿A" }),
          makeCommentItem({ id: "c1", excerpt: "コメントB" }),
        ]}
      />,
    );
    expect(screen.getByText("投稿A")).toBeInTheDocument();
    expect(screen.getByText("コメントB")).toBeInTheDocument();
  });

  it("アイテムが 0 件のとき data-testid=trending-sidebar-empty の空状態メッセージが表示される", () => {
    render(<TrendingSidebarCard items={[]} />);
    const empty = screen.getByTestId("trending-sidebar-empty");
    expect(empty).toHaveTextContent("まだ評価の高い投稿がありません。");
  });

  it("アイテムが 0 件のときリンクは表示されない", () => {
    render(<TrendingSidebarCard items={[]} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("各アイテムに薄いグレー背景色が設定される", () => {
    render(<TrendingSidebarCard items={[makePostItem({ excerpt: "スタイル確認用" })]} />);
    const item = screen.getByText("スタイル確認用").closest("li");
    expect(item).toHaveStyle({ backgroundColor: SLACK_COLORS.mainBackground });
  });

  it("各アイテムの角丸が16px未満で設定される", () => {
    render(<TrendingSidebarCard items={[makePostItem({ excerpt: "角丸確認用" })]} />);
    const item = screen.getByText("角丸確認用").closest("li");
    const borderRadius = parseFloat(getComputedStyle(item as Element).borderRadius);
    expect(borderRadius).toBeGreaterThan(0);
    expect(borderRadius).toBeLessThan(16);
  });
});
