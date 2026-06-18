import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../hooks/useExternalLink.js", () => ({
  useExternalLink: vi.fn(),
}));

import { useExternalLink } from "../hooks/useExternalLink.js";
import { TextWithLinks } from "./TextWithLinks.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TextWithLinks", () => {
  describe("URL を含まないテキスト", () => {
    it("URL を含まないテキストはそのまま表示される", () => {
      vi.mocked(useExternalLink).mockReturnValue({ openExternalLink: vi.fn() });

      render(<TextWithLinks text="普通のテキストです。URL は含まれません。" />);
      expect(screen.getByText("普通のテキストです。URL は含まれません。")).toBeInTheDocument();
      expect(screen.queryByRole("link")).toBeNull();
    });
  });

  describe("URL を含むテキスト", () => {
    it("https:// URL がリンク要素として描画される", () => {
      vi.mocked(useExternalLink).mockReturnValue({ openExternalLink: vi.fn() });

      render(<TextWithLinks text="詳細は https://example.com を参照してください" />);
      const link = screen.getByRole("link");
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "https://example.com");
      expect(link.textContent).toBe("https://example.com");
    });

    it("URL の末尾に日本語句読点（。）が続く場合、句読点は URL から切り離される", () => {
      vi.mocked(useExternalLink).mockReturnValue({ openExternalLink: vi.fn() });

      // \S+ は空白で止まるため、空白の前に句読点が来るケースで除去が効く
      render(<TextWithLinks text="詳細は https://example.com。 参照してください" />);
      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "https://example.com");
      expect(link.textContent).toBe("https://example.com");
    });

    it("リンクをクリックすると openExternalLink が href と共に呼ばれる", async () => {
      const openExternalLink = vi.fn();
      vi.mocked(useExternalLink).mockReturnValue({ openExternalLink });

      render(<TextWithLinks text="https://example.com" />);
      await userEvent.click(screen.getByRole("link"));
      expect(openExternalLink).toHaveBeenCalledWith("https://example.com");
      expect(openExternalLink).toHaveBeenCalledTimes(1);
    });

    it("複数 URL が含まれるテキストでそれぞれリンクになる", () => {
      vi.mocked(useExternalLink).mockReturnValue({ openExternalLink: vi.fn() });

      render(<TextWithLinks text="https://example.com と https://github.com を参照" />);
      const links = screen.getAllByRole("link");
      expect(links).toHaveLength(2);
      expect(links[0]).toHaveAttribute("href", "https://example.com");
      expect(links[1]).toHaveAttribute("href", "https://github.com");
    });
  });
});
