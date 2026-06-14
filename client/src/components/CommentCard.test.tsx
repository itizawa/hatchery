import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CommentCard } from "./CommentCard";

const mockComment = {
  id: "comment-1",
  community_id: "community-1",
  post_id: "post-1",
  slot_key: "2026-06-01-morning",
  seq: 1,
  author: "worker-ken",
  text: "いつも元気ですね！",
  score: 2,
  created_at: "2026-06-01T09:01:00Z",
};

describe("CommentCard", () => {
  it("comment の本文を表示する", () => {
    render(<CommentCard comment={mockComment} onVote={vi.fn()} />);
    expect(screen.getByText("いつも元気ですね！")).toBeInTheDocument();
  });

  it("author を表示する", () => {
    render(<CommentCard comment={mockComment} onVote={vi.fn()} />);
    expect(screen.getByText("worker-ken")).toBeInTheDocument();
  });

  it("score を表示する", () => {
    render(<CommentCard comment={mockComment} onVote={vi.fn()} />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("up vote ボタンがあり、クリックすると onVote が呼ばれる", async () => {
    const onVote = vi.fn();
    render(<CommentCard comment={mockComment} onVote={onVote} />);
    await userEvent.click(screen.getByRole("button", { name: /up vote/i }));
    expect(onVote).toHaveBeenCalledTimes(1);
  });

  it("コメント入力欄は表示しない（ADR-0020）", () => {
    render(<CommentCard comment={mockComment} onVote={vi.fn()} />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  describe("投稿時刻の相対表示（#502）", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // mockComment.created_at = 2026-06-01T09:01:00Z の59分後を現在時刻に固定
      vi.setSystemTime(new Date("2026-06-01T10:00:00Z"));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("created_at を相対時間（N分前）で表示する", () => {
      render(<CommentCard comment={mockComment} onVote={vi.fn()} />);
      expect(screen.getByText("59分前")).toBeInTheDocument();
    });

    it("時刻は time 要素で表示し dateTime に ISO 文字列を持つ", () => {
      const { container } = render(<CommentCard comment={mockComment} onVote={vi.fn()} />);
      const timeEl = container.querySelector("time");
      expect(timeEl).not.toBeNull();
      expect(timeEl).toHaveAttribute("dateTime", new Date(mockComment.created_at).toISOString());
    });

    it("created_at が未指定（後方互換）のときは時刻を描画しない", () => {
      const commentWithout = { ...mockComment };
      delete (commentWithout as { created_at?: string }).created_at;
      const { container } = render(<CommentCard comment={commentWithout} onVote={vi.fn()} />);
      expect(container.querySelector("time")).toBeNull();
    });
  });

  describe("author_worker（発言者のアバター + 表示名・#479）", () => {
    const commentWithWorker = {
      ...mockComment,
      author: "uuid-ken",
      author_worker: {
        id: "uuid-ken",
        display_name: "ken",
        image_url: "https://example.com/ken.png",
      },
    };

    it("author_worker.image_url があるときアバター画像（alt=表示名）を表示する", () => {
      render(<CommentCard comment={commentWithWorker} onVote={vi.fn()} />);
      const img = screen.getByRole("img", { name: "ken" });
      expect(img).toHaveAttribute("src", "https://example.com/ken.png");
    });

    it("author_worker.display_name（表示名）を表示し、生の author ID は表示しない", () => {
      render(<CommentCard comment={commentWithWorker} onVote={vi.fn()} />);
      expect(screen.getByText("ken")).toBeInTheDocument();
      expect(screen.queryByText("uuid-ken")).not.toBeInTheDocument();
    });

    it("image_url が null のときは画像を出さずフォールバック（頭文字）＋表示名を表示する", () => {
      const comment = {
        ...mockComment,
        author: "uuid-mei",
        author_worker: { id: "uuid-mei", display_name: "mei", image_url: null },
      };
      render(<CommentCard comment={comment} onVote={vi.fn()} />);
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      expect(screen.getByText("mei")).toBeInTheDocument();
      expect(screen.getByText("M")).toBeInTheDocument();
    });

    it("author_worker が無いときは生の author 文字列を表示する（フォールバック・破綻しない）", () => {
      render(<CommentCard comment={mockComment} onVote={vi.fn()} />);
      expect(screen.getByText("worker-ken")).toBeInTheDocument();
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });
  });
});
