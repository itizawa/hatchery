import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LoginDialog } from "./LoginDialog";

describe("LoginDialog", () => {
  it("open=true のとき「Google でログイン」ボタンとログイン見出しが表示される", () => {
    render(<LoginDialog open onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: /ログイン/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Google でログイン/ })).toBeInTheDocument();
  });

  it("open=false のときダイアログ内容が表示されない", () => {
    render(<LoginDialog open={false} onClose={() => {}} />);
    expect(screen.queryByRole("button", { name: /Google でログイン/ })).not.toBeInTheDocument();
  });

  it("ID/パスワードフォームは存在しない（#455: Google 認証のみ）", () => {
    render(<LoginDialog open onClose={() => {}} />);
    expect(screen.queryByLabelText(/ID/)).toBeNull();
    expect(screen.queryByLabelText(/パスワード/)).toBeNull();
  });

  it("閉じるボタンをクリックすると onClose が呼ばれる", async () => {
    const onClose = vi.fn();
    render(<LoginDialog open onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: /閉じる/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("「Google でログイン」ボタンクリックで Google OAuth 開始 URL へ遷移する", async () => {
    // window.location.href への代入を観測する。
    const hrefSetter = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...original, set href(value: string) {
        hrefSetter(value);
      } },
    });
    try {
      render(<LoginDialog open onClose={() => {}} />);
      await userEvent.click(screen.getByRole("button", { name: /Google でログイン/ }));
      expect(hrefSetter).toHaveBeenCalledTimes(1);
      expect(hrefSetter.mock.calls[0][0]).toMatch(/\/api\/auth\/google$/);
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: original });
    }
  });
});
