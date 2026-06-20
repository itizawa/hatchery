import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { VoteControl } from "./VoteControl";

describe("VoteControl", () => {
  it("up_count を中央に表示する（score ではなく up 件数を表示・#814）", () => {
    render(<VoteControl score={-2} upCount={5} onVote={vi.fn()} />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.queryByText("-2")).not.toBeInTheDocument();
  });

  it("up_count が 0 でも表示する（#814）", () => {
    render(<VoteControl score={3} upCount={0} onVote={vi.fn()} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("score を中央に表示する（後方互換: upCount 省略時は score を表示）", () => {
    render(<VoteControl score={5} onVote={vi.fn()} />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("score が負数でも表示する（後方互換）", () => {
    render(<VoteControl score={-3} onVote={vi.fn()} />);
    expect(screen.getByText("-3")).toBeInTheDocument();
  });

  it("up vote ボタンが表示される", () => {
    render(<VoteControl score={0} onVote={vi.fn()} />);
    expect(screen.getByRole("button", { name: /up vote/i })).toBeInTheDocument();
  });

  it("down vote ボタンが表示される", () => {
    render(<VoteControl score={0} onVote={vi.fn()} />);
    expect(screen.getByRole("button", { name: /down vote/i })).toBeInTheDocument();
  });

  it("up ボタンをクリックすると onVote('up') が呼ばれる", async () => {
    const onVote = vi.fn();
    render(<VoteControl score={0} onVote={onVote} />);
    await userEvent.click(screen.getByRole("button", { name: /up vote/i }));
    expect(onVote).toHaveBeenCalledWith("up");
    expect(onVote).toHaveBeenCalledTimes(1);
  });

  it("down ボタンをクリックすると onVote('down') が呼ばれる", async () => {
    const onVote = vi.fn();
    render(<VoteControl score={0} onVote={onVote} />);
    await userEvent.click(screen.getByRole("button", { name: /down vote/i }));
    expect(onVote).toHaveBeenCalledWith("down");
    expect(onVote).toHaveBeenCalledTimes(1);
  });

  it("currentVote='up' のとき up ボタンが pressed 状態になる", () => {
    render(<VoteControl score={1} onVote={vi.fn()} currentVote="up" />);
    expect(screen.getByRole("button", { name: /up vote/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /down vote/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("currentVote='down' のとき down ボタンが pressed 状態になる", () => {
    render(<VoteControl score={-1} onVote={vi.fn()} currentVote="down" />);
    expect(screen.getByRole("button", { name: /up vote/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /down vote/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("currentVote=null のとき両方 unpressed になる", () => {
    render(<VoteControl score={0} onVote={vi.fn()} currentVote={null} />);
    expect(screen.getByRole("button", { name: /up vote/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /down vote/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("disabled=true のとき両ボタンが無効化される", () => {
    render(<VoteControl score={0} onVote={vi.fn()} disabled />);
    expect(screen.getByRole("button", { name: /up vote/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /down vote/i })).toBeDisabled();
  });

  it("down 累積数は表示しない", () => {
    render(<VoteControl score={-3} onVote={vi.fn()} currentVote="down" />);
    expect(screen.queryByText(/down/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/累積/i)).not.toBeInTheDocument();
  });

  describe("投票済み塗りつぶし表示（#813）", () => {
    it("currentVote='up' のとき pill コンテナに data-voted='up' が付く", () => {
      const { container } = render(<VoteControl score={1} onVote={vi.fn()} currentVote="up" />);
      expect(container.firstChild).toHaveAttribute("data-voted", "up");
    });

    it("currentVote='down' のとき pill コンテナに data-voted='down' が付く", () => {
      const { container } = render(<VoteControl score={-1} onVote={vi.fn()} currentVote="down" />);
      expect(container.firstChild).toHaveAttribute("data-voted", "down");
    });

    it("currentVote=null のとき pill コンテナに data-voted='none' が付く", () => {
      const { container } = render(<VoteControl score={0} onVote={vi.fn()} currentVote={null} />);
      expect(container.firstChild).toHaveAttribute("data-voted", "none");
    });

    it("currentVote='up' のとき up のみ active で down は非 active（排他性）", () => {
      render(<VoteControl score={1} onVote={vi.fn()} currentVote="up" />);
      expect(screen.getByRole("button", { name: /up vote/i })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: /down vote/i })).toHaveAttribute("aria-pressed", "false");
    });

    it("currentVote='down' のとき down のみ active で up は非 active（排他性）", () => {
      render(<VoteControl score={-1} onVote={vi.fn()} currentVote="down" />);
      expect(screen.getByRole("button", { name: /down vote/i })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: /up vote/i })).toHaveAttribute("aria-pressed", "false");
    });
  });

  describe("ツールチップ", () => {
    it("up vote ボタンに『高評価』ツールチップが付く", async () => {
      const user = userEvent.setup();
      render(<VoteControl score={0} onVote={vi.fn()} />);
      await user.hover(screen.getByRole("button", { name: /up vote/i }));
      expect(await screen.findByRole("tooltip", { name: "高評価" })).toBeInTheDocument();
    });

    it("down vote ボタンに『低評価』ツールチップが付く", async () => {
      const user = userEvent.setup();
      render(<VoteControl score={0} onVote={vi.fn()} />);
      await user.hover(screen.getByRole("button", { name: /down vote/i }));
      expect(await screen.findByRole("tooltip", { name: "低評価" })).toBeInTheDocument();
    });
  });

  describe("pill コンテナ レンダリング", () => {
    it("up vote ボタンは IconButton（button 要素・ MuiIconButton-root）としてレンダリングされる", () => {
      const { container } = render(<VoteControl score={0} onVote={vi.fn()} />);
      const upEl = container.querySelector('[aria-label="up vote"]');
      expect(upEl?.tagName).toBe("BUTTON");
      expect(upEl?.classList.contains("MuiIconButton-root")).toBe(true);
    });

    it("down vote ボタンは IconButton（button 要素・ MuiIconButton-root）としてレンダリングされる", () => {
      const { container } = render(<VoteControl score={0} onVote={vi.fn()} />);
      const downEl = container.querySelector('[aria-label="down vote"]');
      expect(downEl?.tagName).toBe("BUTTON");
      expect(downEl?.classList.contains("MuiIconButton-root")).toBe(true);
    });

    it("up と down ボタンは同一の pill コンテナ内に存在する", () => {
      const { container } = render(<VoteControl score={0} onVote={vi.fn()} />);
      const upEl = container.querySelector('[aria-label="up vote"]');
      const downEl = container.querySelector('[aria-label="down vote"]');
      // Tooltip の <span> ラッパーを考慮し、共通の Box コンテナ（MuiBox-root）で同居を確認
      const upContainer = upEl?.closest(".MuiBox-root");
      const downContainer = downEl?.closest(".MuiBox-root");
      expect(upContainer).toBeTruthy();
      expect(upContainer).toBe(downContainer);
    });
  });
});
