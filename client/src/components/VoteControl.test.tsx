import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { VoteControl } from "./VoteControl";

describe("VoteControl", () => {
  it("score を中央に表示する", () => {
    render(<VoteControl score={5} onVote={vi.fn()} />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("score が負数でも表示する", () => {
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
});
