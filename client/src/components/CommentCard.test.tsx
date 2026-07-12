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

  describe("コネクターライン（#746）", () => {
    it("depth > 0 のとき L字コネクター（comment-l-connector）が描画される", () => {
      const { container } = render(<CommentCard comment={mockComment} onVote={vi.fn()} depth={1} />);
      expect(container.querySelector('[data-testid="comment-l-connector"]')).toBeInTheDocument();
    });

    it("depth = 0 のとき L字コネクターは描画されない", () => {
      const { container } = render(<CommentCard comment={mockComment} onVote={vi.fn()} depth={0} />);
      expect(container.querySelector('[data-testid="comment-l-connector"]')).not.toBeInTheDocument();
    });
  });

  describe("アバター下スレッドコネクター（#796）", () => {
    it("hasChildren=true のとき縦線（comment-avatar-connector）が描画される", () => {
      const { container } = render(
        <CommentCard comment={mockComment} onVote={vi.fn()} hasChildren={true} />,
      );
      expect(
        container.querySelector('[data-testid="comment-avatar-connector"]'),
      ).toBeInTheDocument();
    });

    it("hasChildren=false のとき縦線（comment-avatar-connector）は描画されない", () => {
      const { container } = render(
        <CommentCard comment={mockComment} onVote={vi.fn()} hasChildren={false} />,
      );
      expect(
        container.querySelector('[data-testid="comment-avatar-connector"]'),
      ).not.toBeInTheDocument();
    });

    it("hasChildren を省略したとき縦線（comment-avatar-connector）は描画されない", () => {
      const { container } = render(<CommentCard comment={mockComment} onVote={vi.fn()} />);
      expect(
        container.querySelector('[data-testid="comment-avatar-connector"]'),
      ).not.toBeInTheDocument();
    });

    it("depth=0 かつ hasChildren=true のとき left が 12 になる", () => {
      const { container } = render(
        <CommentCard comment={mockComment} onVote={vi.fn()} depth={0} hasChildren={true} />,
      );
      const el = container.querySelector('[data-testid="comment-avatar-connector"]');
      expect(el).toBeInTheDocument();
      // clampedDepth=0, INDENT_PER_DEPTH=16 → left: 0*16+12 = 12px → data-left="12"
      expect((el as HTMLElement).dataset.left).toBe("12");
    });

    it("depth=1 かつ hasChildren=true のとき left が 28 になる", () => {
      const { container } = render(
        <CommentCard comment={mockComment} onVote={vi.fn()} depth={1} hasChildren={true} />,
      );
      const el = container.querySelector('[data-testid="comment-avatar-connector"]');
      expect(el).toBeInTheDocument();
      // clampedDepth=1, INDENT_PER_DEPTH=16 → left: 1*16+12 = 28px → data-left="28"
      expect((el as HTMLElement).dataset.left).toBe("28");
    });
  });

  describe("アクションバーのレイアウト（#683）", () => {
    it("vote コントロール（up vote ボタン）が本文テキストより後（DOM 順で後）に現れる", () => {
      render(<CommentCard comment={mockComment} onVote={vi.fn()} />);
      const upVoteBtn = screen.getByRole("button", { name: /up vote/i });
      const bodyEl = screen.getByText("いつも元気ですね！");
      // bodyEl が upVoteBtn より前（upVoteBtn は bodyEl の後に現れる）
      expect(bodyEl.compareDocumentPosition(upVoteBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

    it("image_url が null のとき boring-avatars で描画し display_name を表示する (#1015)", () => {
      const comment = {
        ...mockComment,
        author: "uuid-mei",
        author_worker: { id: "uuid-mei", display_name: "mei", image_url: null },
      };
      render(<CommentCard comment={comment} onVote={vi.fn()} />);
      expect(screen.getByText("mei")).toBeInTheDocument();
      const avatar = screen.getByRole("img", { name: "mei" });
      expect(avatar).toBeInTheDocument();
      expect(avatar).not.toHaveAttribute("src");
    });

    it("author_worker が無いときは生の author 文字列を表示する（フォールバック・破綻しない）", () => {
      render(<CommentCard comment={mockComment} onVote={vi.fn()} />);
      expect(screen.getByText("worker-ken")).toBeInTheDocument();
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });
  });

  describe("upVoteDisabled / downVoteDisabled（方向別ペンディング・#890）", () => {
    it("upVoteDisabled=true のとき up ボタンのみ disabled、down は enabled", () => {
      render(<CommentCard comment={mockComment} onVote={vi.fn()} upVoteDisabled />);
      expect(screen.getByRole("button", { name: /up vote/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /down vote/i })).not.toBeDisabled();
    });

    it("downVoteDisabled=true のとき down ボタンのみ disabled、up は enabled", () => {
      render(<CommentCard comment={mockComment} onVote={vi.fn()} downVoteDisabled />);
      expect(screen.getByRole("button", { name: /up vote/i })).not.toBeDisabled();
      expect(screen.getByRole("button", { name: /down vote/i })).toBeDisabled();
    });

    it("upVoteDisabled=true かつ downVoteDisabled=true のとき両ボタンが disabled", () => {
      render(<CommentCard comment={mockComment} onVote={vi.fn()} upVoteDisabled downVoteDisabled />);
      expect(screen.getByRole("button", { name: /up vote/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /down vote/i })).toBeDisabled();
    });

    it("upVoteDisabled・downVoteDisabled 未指定（デフォルト false）のとき vote ボタンは有効のまま", () => {
      render(<CommentCard comment={mockComment} onVote={vi.fn()} />);
      expect(screen.getByRole("button", { name: /up vote/i })).not.toBeDisabled();
      expect(screen.getByRole("button", { name: /down vote/i })).not.toBeDisabled();
    });
  });

  describe("loading prop（#857）", () => {
    it("loading={true} のとき Skeleton が描画される", () => {
      const { container } = render(<CommentCard loading />);
      expect(container.querySelectorAll(".MuiSkeleton-root").length).toBeGreaterThan(0);
    });

    it("loading={true} のときデータ由来のテキスト（author・本文・score）が DOM に存在しない", () => {
      render(<CommentCard loading />);
      expect(screen.queryByText("いつも元気ですね！")).not.toBeInTheDocument();
      expect(screen.queryByText("worker-ken")).not.toBeInTheDocument();
      expect(screen.queryByText("2")).not.toBeInTheDocument();
    });

    it("loading={true} のとき vote ボタンが表示されない", () => {
      render(<CommentCard loading />);
      expect(screen.queryByRole("button", { name: /up vote/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /down vote/i })).not.toBeInTheDocument();
    });
  });

  describe("引用プレビューの撤去（#1064・#931 の一部撤回）", () => {
    it("引用プレビュー（comment-quote-preview）は描画されない", () => {
      const { container } = render(<CommentCard comment={mockComment} onVote={vi.fn()} />);
      expect(container.querySelector('[data-testid="comment-quote-preview"]')).not.toBeInTheDocument();
    });
  });

  describe("共有ボタン（#775）", () => {
    it("postId を渡すと共有ボタンが表示される", () => {
      render(<CommentCard comment={mockComment} onVote={vi.fn()} postId="post-1" />);
      expect(screen.getByRole("button", { name: /共有/i })).toBeInTheDocument();
    });

    it("postId を渡さない場合は共有ボタンが表示されない", () => {
      render(<CommentCard comment={mockComment} onVote={vi.fn()} />);
      expect(screen.queryByRole("button", { name: /共有/i })).not.toBeInTheDocument();
    });

    it("共有ボタンの shareUrl が ${origin}/posts/<postId>#comment-<commentId> 形式になる", async () => {
      // jsdom のデフォルト origin は "http://localhost"
      // navigator.clipboard.writeText をスパイして実際にコピーされる URL を検証する
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        writable: true,
      });

      render(<CommentCard comment={mockComment} onVote={vi.fn()} postId="post-1" />);
      const shareBtn = screen.getByRole("button", { name: /共有/i });
      await userEvent.click(shareBtn);

      const copyItem = screen.getByText("URL をコピー");
      await userEvent.click(copyItem);

      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/posts/post-1#comment-${mockComment.id}`,
      );
    });
  });

  describe("まとめコメント表示（#1165）", () => {
    it("is_summary=true のとき「まとめ」ラベルが表示される", () => {
      render(<CommentCard comment={{ ...mockComment, is_summary: true }} onVote={vi.fn()} />);
      expect(screen.getByText("まとめ")).toBeInTheDocument();
    });

    it("is_summary=false（または省略）のとき「まとめ」ラベルは表示されない", () => {
      render(<CommentCard comment={mockComment} onVote={vi.fn()} />);
      expect(screen.queryByText("まとめ")).not.toBeInTheDocument();
    });

    it("is_summary=true のとき通常コメントと区別されるルート要素（comment-summary）が描画される", () => {
      const { container } = render(
        <CommentCard comment={{ ...mockComment, is_summary: true }} onVote={vi.fn()} />,
      );
      expect(container.querySelector('[data-testid="comment-summary"]')).toBeInTheDocument();
    });
  });
});
