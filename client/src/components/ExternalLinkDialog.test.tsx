/**
 * ExternalLinkDialog コンポーネントのテスト（Issue #661）
 *
 * 受け入れ条件:
 * - タイトル「外部サイトへのアクセス」が表示される（AC2）
 * - 遷移先のホスト名が表示される（AC2）
 * - 注意事項テキストが表示される（AC2）
 * - 「今後この警告を表示しない」チェックボックスが表示される（AC2）
 * - 「キャンセル」「続行」ボタンが表示される（AC2）
 * - 「続行」クリックで onContinue が呼ばれる（AC3）
 * - 「キャンセル」クリックで onClose が呼ばれる（AC4）
 * - 背景クリック / Esc で onClose が呼ばれる（AC4）
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ExternalLinkDialog } from "./ExternalLinkDialog";

const defaultProps = {
  open: true,
  url: "https://example.com/path?q=1",
  onClose: vi.fn(),
  onContinue: vi.fn(),
  skipWarning: false,
  onSkipWarningChange: vi.fn(),
};

describe("ExternalLinkDialog", () => {
  describe("表示内容", () => {
    it("タイトル「外部サイトへのアクセス」が表示される", () => {
      render(<ExternalLinkDialog {...defaultProps} />);
      expect(screen.getByRole("heading", { name: /外部サイトへのアクセス/ })).toBeInTheDocument();
    });

    it("遷移先のホスト名が表示される", () => {
      render(<ExternalLinkDialog {...defaultProps} url="https://example.com/path?q=1" />);
      expect(screen.getByText(/example\.com/)).toBeInTheDocument();
    });

    it("注意事項テキストが表示される", () => {
      render(<ExternalLinkDialog {...defaultProps} />);
      expect(screen.getByText(/外部サイト/)).toBeInTheDocument();
      expect(screen.getByText(/個人情報/)).toBeInTheDocument();
    });

    it("「今後この警告を表示しない」チェックボックスが表示される", () => {
      render(<ExternalLinkDialog {...defaultProps} />);
      expect(screen.getByRole("checkbox", { name: /今後この警告を表示しない/ })).toBeInTheDocument();
    });

    it("「キャンセル」ボタンが表示される", () => {
      render(<ExternalLinkDialog {...defaultProps} />);
      expect(screen.getByRole("button", { name: "キャンセル" })).toBeInTheDocument();
    });

    it("「続行」ボタンが表示される", () => {
      render(<ExternalLinkDialog {...defaultProps} />);
      expect(screen.getByRole("button", { name: "続行" })).toBeInTheDocument();
    });

    it("open=false のときダイアログが表示されない", () => {
      render(<ExternalLinkDialog {...defaultProps} open={false} />);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("ボタン操作", () => {
    it("「続行」クリックで onContinue が呼ばれる", async () => {
      const onContinue = vi.fn();
      render(<ExternalLinkDialog {...defaultProps} onContinue={onContinue} />);
      await userEvent.click(screen.getByRole("button", { name: "続行" }));
      expect(onContinue).toHaveBeenCalledTimes(1);
    });

    it("「キャンセル」クリックで onClose が呼ばれる", async () => {
      const onClose = vi.fn();
      render(<ExternalLinkDialog {...defaultProps} onClose={onClose} />);
      await userEvent.click(screen.getByRole("button", { name: "キャンセル" }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("チェックボックス", () => {
    it("チェックボックスの変更で onSkipWarningChange が呼ばれる", async () => {
      const onSkipWarningChange = vi.fn();
      render(<ExternalLinkDialog {...defaultProps} onSkipWarningChange={onSkipWarningChange} />);
      await userEvent.click(screen.getByRole("checkbox", { name: /今後この警告を表示しない/ }));
      expect(onSkipWarningChange).toHaveBeenCalledWith(true);
    });

    it("skipWarning=true のときチェックボックスがチェック済みで表示される", () => {
      render(<ExternalLinkDialog {...defaultProps} skipWarning={true} />);
      const checkbox = screen.getByRole("checkbox", { name: /今後この警告を表示しない/ });
      expect(checkbox).toBeChecked();
    });
  });
});
