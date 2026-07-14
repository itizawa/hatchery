import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type React from "react";
import { vi } from "vitest";

import { RelatedPostsSection } from "./RelatedPostsSection.js";
import type { Post } from "../api/posts.js";

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
    title: "関連投稿のタイトル",
    text: "本文",
    author: "worker-1",
    community_id: "community-1",
    score: 3,
    comment_count: 1,
    slot_key: "2026-06-01T00:00",
    seq: 1,
    created_at: "2026-06-01T00:00:00Z",
    ...overrides,
  }) as Post;

describe("RelatedPostsSection", () => {
  it("posts が空配列のとき related-posts-section が描画されない", () => {
    render(<RelatedPostsSection posts={[]} />);
    expect(screen.queryByTestId("related-posts-section")).not.toBeInTheDocument();
  });

  it("posts が1件のときタイトルが表示される", () => {
    render(<RelatedPostsSection posts={[makePost({ title: "テスト関連投稿" })]} />);
    expect(screen.getByText("テスト関連投稿")).toBeInTheDocument();
  });

  it("posts が1件のとき /posts/$postId へのリンクとして描画される", () => {
    render(<RelatedPostsSection posts={[makePost({ id: "post-abc", title: "リンク確認用" })]} />);
    const link = screen.getByRole("link", { name: "リンク確認用" });
    expect(link).toHaveAttribute("href", "/posts/post-abc");
  });

  it("posts が複数件のとき全件のタイトルが表示される", () => {
    render(
      <RelatedPostsSection
        posts={[
          makePost({ id: "p1", title: "投稿A" }),
          makePost({ id: "p2", title: "投稿B" }),
          makePost({ id: "p3", title: "投稿C" }),
        ]}
      />,
    );
    expect(screen.getByText("投稿A")).toBeInTheDocument();
    expect(screen.getByText("投稿B")).toBeInTheDocument();
    expect(screen.getByText("投稿C")).toBeInTheDocument();
  });
});
