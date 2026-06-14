import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PostCard } from "./PostCard";

const mockPost = {
  id: "post-1",
  community_id: "community-1",
  slot_key: "2026-06-01-morning",
  seq: 1,
  author: "worker-haru",
  title: "今日も元気に始めましょう",
  text: "おはようございます！今日もよろしくお願いします。",
  score: 5,
  created_at: "2026-06-01T09:00:00Z",
  comment_count: 3,
};

describe("PostCard", () => {
  it("post のタイトルを表示する", () => {
    render(<PostCard post={mockPost} onVote={vi.fn()} />);
    expect(screen.getByText("今日も元気に始めましょう")).toBeInTheDocument();
  });

  it("post の本文を表示する", () => {
    render(<PostCard post={mockPost} onVote={vi.fn()} />);
    expect(screen.getByText("おはようございます！今日もよろしくお願いします。")).toBeInTheDocument();
  });

  it("author を表示する", () => {
    render(<PostCard post={mockPost} onVote={vi.fn()} />);
    expect(screen.getByText("worker-haru")).toBeInTheDocument();
  });

  it("score を表示する", () => {
    render(<PostCard post={mockPost} onVote={vi.fn()} />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("up vote ボタンがあり、クリックすると onVote('up') が呼ばれる", async () => {
    const onVote = vi.fn();
    render(<PostCard post={mockPost} onVote={onVote} />);
    await userEvent.click(screen.getByRole("button", { name: /up vote/i }));
    expect(onVote).toHaveBeenCalledWith("up");
    expect(onVote).toHaveBeenCalledTimes(1);
  });

  it("down vote ボタンがあり、クリックすると onVote('down') が呼ばれる", async () => {
    const onVote = vi.fn();
    render(<PostCard post={mockPost} onVote={onVote} />);
    await userEvent.click(screen.getByRole("button", { name: /down vote/i }));
    expect(onVote).toHaveBeenCalledWith("down");
    expect(onVote).toHaveBeenCalledTimes(1);
  });

  it("ShareButton（共有ボタン）が vote コントロールの近くに表示される", () => {
    render(<PostCard post={mockPost} onVote={vi.fn()} postUrl="https://example.com/posts/post-1" />);
    expect(screen.getByRole("button", { name: /共有/i })).toBeInTheDocument();
  });

  it("postUrl が無いときは ShareButton を表示しない", () => {
    render(<PostCard post={mockPost} onVote={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /共有/i })).not.toBeInTheDocument();
  });

  it("投稿欄・コメント入力欄は表示しない（ADR-0020）", () => {
    render(<PostCard post={mockPost} onVote={vi.fn()} />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  describe("comment_count（コメント数表示・#500）", () => {
    it("コメント数を「💬 N」相当で表示する（N>0）", () => {
      render(<PostCard post={mockPost} onVote={vi.fn()} />);
      const el = screen.getByLabelText("コメント 3 件");
      expect(el).toBeInTheDocument();
      expect(el).toHaveTextContent("3");
    });

    it("コメントが無い場合は「💬 0」を表示する（N=0）", () => {
      render(<PostCard post={{ ...mockPost, comment_count: 0 }} onVote={vi.fn()} />);
      const el = screen.getByLabelText("コメント 0 件");
      expect(el).toBeInTheDocument();
      expect(el).toHaveTextContent("0");
    });

    it("comment_count が未指定でも 0 として表示する（後方互換）", () => {
      const postWithout = { ...mockPost };
      delete (postWithout as { comment_count?: number }).comment_count;
      render(<PostCard post={postWithout} onVote={vi.fn()} />);
      expect(screen.getByLabelText("コメント 0 件")).toBeInTheDocument();
    });
  });

  describe("author_worker（発言者のアバター + 表示名・#479）", () => {
    const postWithWorker = {
      ...mockPost,
      author: "uuid-haru",
      author_worker: {
        id: "uuid-haru",
        display_name: "haru",
        image_url: "https://example.com/haru.png",
      },
    };

    it("author_worker.image_url があるときアバター画像（alt=表示名）を表示する", () => {
      render(<PostCard post={postWithWorker} onVote={vi.fn()} />);
      const img = screen.getByRole("img", { name: "haru" });
      expect(img).toHaveAttribute("src", "https://example.com/haru.png");
    });

    it("author_worker.display_name（表示名）を表示し、生の author ID は表示しない", () => {
      render(<PostCard post={postWithWorker} onVote={vi.fn()} />);
      expect(screen.getByText("haru")).toBeInTheDocument();
      expect(screen.queryByText("uuid-haru")).not.toBeInTheDocument();
    });

    it("image_url が null のときは画像を出さずフォールバック（頭文字）＋表示名を表示する", () => {
      const post = {
        ...mockPost,
        author: "uuid-ken",
        author_worker: { id: "uuid-ken", display_name: "ken", image_url: null },
      };
      render(<PostCard post={post} onVote={vi.fn()} />);
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      expect(screen.getByText("ken")).toBeInTheDocument();
      // フォールバックの頭文字（大文字）アバターを表示する
      expect(screen.getByText("K")).toBeInTheDocument();
    });

    it("author_worker が無いときは生の author 文字列を表示する（フォールバック・破綻しない）", () => {
      render(<PostCard post={mockPost} onVote={vi.fn()} />);
      expect(screen.getByText("worker-haru")).toBeInTheDocument();
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });
  });

  describe("truncateText（フィード一覧での本文省略・#501）", () => {
    const longPost = {
      ...mockPost,
      text: "1段落目はとても長い本文です。\n\n2段落目も続きます。\n\n3段落目もあります。\n\n4段落目まで続く長文。",
    };

    it("truncateText 有効時は本文に line-clamp スタイルが適用される", () => {
      render(<PostCard post={longPost} onVote={vi.fn()} truncateText />);
      const textEl = screen.getByText(/1段落目はとても長い本文です/);
      expect(textEl).toHaveStyle({
        display: "-webkit-box",
        WebkitLineClamp: "3",
        overflow: "hidden",
      });
    });

    it("truncateText 無効（デフォルト）時は line-clamp スタイルを適用せず全文表示する", () => {
      render(<PostCard post={longPost} onVote={vi.fn()} />);
      const textEl = screen.getByText(/1段落目はとても長い本文です/);
      expect(textEl).not.toHaveStyle({ display: "-webkit-box" });
    });
  });

  describe("voteStopPropagation", () => {
    it.each([
      ["up vote", /up vote/i],
      ["down vote", /down vote/i],
    ] as const)("有効時の %s クリックで stopPropagation と preventDefault の両方が呼ばれる", (_label, namePattern) => {
      render(<PostCard post={mockPost} onVote={vi.fn()} voteStopPropagation={true} />);

      const event = new MouseEvent("click", { bubbles: true, cancelable: true });
      const stopPropagationSpy = vi.spyOn(event, "stopPropagation");
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");

      fireEvent(screen.getByRole("button", { name: namePattern }), event);

      expect(stopPropagationSpy).toHaveBeenCalled();
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it("有効時でも onVote が正しい direction で呼ばれる（回帰確認）", async () => {
      const onVote = vi.fn();
      render(<PostCard post={mockPost} onVote={onVote} voteStopPropagation={true} />);

      await userEvent.click(screen.getByRole("button", { name: /up vote/i }));
      expect(onVote).toHaveBeenCalledWith("up");

      await userEvent.click(screen.getByRole("button", { name: /down vote/i }));
      expect(onVote).toHaveBeenCalledWith("down");
    });
  });
});
