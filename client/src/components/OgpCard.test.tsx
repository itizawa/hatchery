import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/ogp.js", () => ({
  useOgp: vi.fn(),
}));

vi.mock("../hooks/useExternalLink.js", () => ({
  useExternalLink: vi.fn(),
}));

import { useOgp } from "../api/ogp.js";
import { useExternalLink } from "../hooks/useExternalLink.js";
import { OgpCard } from "./OgpCard.js";

afterEach(() => {
  vi.resetAllMocks();
});

describe("OgpCard", () => {
  describe("非表示条件", () => {
    it("useOgp の data が undefined（取得中）のときは何もレンダリングされない", () => {
      vi.mocked(useOgp).mockReturnValue({ data: undefined } as ReturnType<typeof useOgp>);
      vi.mocked(useExternalLink).mockReturnValue({ openExternalLink: vi.fn() });

      const { container } = render(<OgpCard url="https://example.com" />);
      expect(container).toBeEmptyDOMElement();
    });

    it("ogp.title が null のときは何もレンダリングされない", () => {
      vi.mocked(useOgp).mockReturnValue({ data: { title: null } } as ReturnType<typeof useOgp>);
      vi.mocked(useExternalLink).mockReturnValue({ openExternalLink: vi.fn() });

      const { container } = render(<OgpCard url="https://example.com" />);
      expect(container).toBeEmptyDOMElement();
    });

    it("ogp.title が undefined のときは何もレンダリングされない", () => {
      vi.mocked(useOgp).mockReturnValue({ data: { title: undefined } } as ReturnType<typeof useOgp>);
      vi.mocked(useExternalLink).mockReturnValue({ openExternalLink: vi.fn() });

      const { container } = render(<OgpCard url="https://example.com" />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("表示条件", () => {
    it("ogp.title が存在するときカード要素（role=link）がレンダリングされタイトルが表示される", () => {
      vi.mocked(useOgp).mockReturnValue({
        data: { title: "テスト記事タイトル" },
      } as ReturnType<typeof useOgp>);
      vi.mocked(useExternalLink).mockReturnValue({ openExternalLink: vi.fn() });

      render(<OgpCard url="https://example.com" />);
      expect(screen.getByRole("link")).toBeInTheDocument();
      expect(screen.getByText("テスト記事タイトル")).toBeInTheDocument();
    });

    it("ogp.image が存在するとき img 要素がレンダリングされる", () => {
      vi.mocked(useOgp).mockReturnValue({
        data: { title: "テスト記事タイトル", image: "https://example.com/ogp.png" },
      } as ReturnType<typeof useOgp>);
      vi.mocked(useExternalLink).mockReturnValue({ openExternalLink: vi.fn() });

      render(<OgpCard url="https://example.com" />);
      const img = screen.getByRole("img");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "https://example.com/ogp.png");
    });

    it("ogp.image が存在しないとき img 要素はレンダリングされない", () => {
      vi.mocked(useOgp).mockReturnValue({
        data: { title: "テスト記事タイトル", image: null },
      } as ReturnType<typeof useOgp>);
      vi.mocked(useExternalLink).mockReturnValue({ openExternalLink: vi.fn() });

      render(<OgpCard url="https://example.com" />);
      expect(screen.queryByRole("img")).toBeNull();
    });
  });

  describe("インタラクション", () => {
    it("カードをクリックすると openExternalLink が url と共に呼ばれる", async () => {
      const openExternalLink = vi.fn();
      vi.mocked(useOgp).mockReturnValue({
        data: { title: "テスト記事タイトル" },
      } as ReturnType<typeof useOgp>);
      vi.mocked(useExternalLink).mockReturnValue({ openExternalLink });

      render(<OgpCard url="https://example.com" />);
      await userEvent.click(screen.getByRole("link"));
      expect(openExternalLink).toHaveBeenCalledWith("https://example.com");
      expect(openExternalLink).toHaveBeenCalledTimes(1);
    });

    it("Enter キーを押すと openExternalLink が url と共に呼ばれる", async () => {
      const openExternalLink = vi.fn();
      vi.mocked(useOgp).mockReturnValue({
        data: { title: "テスト記事タイトル" },
      } as ReturnType<typeof useOgp>);
      vi.mocked(useExternalLink).mockReturnValue({ openExternalLink });

      render(<OgpCard url="https://example.com" />);
      screen.getByRole("link").focus();
      await userEvent.keyboard("{Enter}");
      expect(openExternalLink).toHaveBeenCalledWith("https://example.com");
      expect(openExternalLink).toHaveBeenCalledTimes(1);
    });
  });
});
