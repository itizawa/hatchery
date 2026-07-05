/**
 * MarkdownContent コンポーネントのテスト（Issue #513）
 *
 * 受け入れ条件:
 * - 代表的な Markdown 記法が期待どおりの要素にレンダリングされる（受け入れ条件 5）
 * - XSS 防止: <script> タグ・javascript: スキーム・onerror 等がスクリプト実行可能な DOM に変換されない（受け入れ条件 4）
 * - 画像インライン埋め込みを許可しない（受け入れ条件 2）
 * - 外部リンクは外部リンク確認フローを経由して開く（#661 受け入れ条件 2）
 * - プレーンテキストも破綶なく表示できる（受け入れ条件 3・後方互換）
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MarkdownContent } from "./MarkdownContent";

describe("MarkdownContent", () => {
  describe("基本 Markdown 記法のレンダリング", () => {
    it("プレーンテキストをそのまま表示する（後方互換）", () => {
      render(<MarkdownContent content="こんにちは、世界！" />);
      expect(screen.getByText("こんにちは、世界！")).toBeInTheDocument();
    });

    it("太字（**text**）を strong 要素でレンダリングする", () => {
      const { container } = render(<MarkdownContent content="**太字テキスト**" />);
      const strong = container.querySelector("strong");
      expect(strong).not.toBeNull();
      expect(strong?.textContent).toBe("太字テキスト");
    });

    it("斜体（*text*）を em 要素でレンダリングする", () => {
      const { container } = render(<MarkdownContent content="*斜体テキスト*" />);
      const em = container.querySelector("em");
      expect(em).not.toBeNull();
      expect(em?.textContent).toBe("斜体テキスト");
    });

    it("打ち消し線（~~text~~）を del 要素でレンダリングする（GFM）", () => {
      const { container } = render(<MarkdownContent content="~~打ち消しテキスト~~" />);
      const del = container.querySelector("del");
      expect(del).not.toBeNull();
      expect(del?.textContent).toBe("打ち消しテキスト");
    });

    it("インラインコード（`code`）を code 要素でレンダリングする", () => {
      const { container } = render(<MarkdownContent content="`インラインコード`" />);
      const code = container.querySelector("code");
      expect(code).not.toBeNull();
      expect(code?.textContent).toBe("インラインコード");
    });

    it("コードブロック（```...```）を pre > code でレンダリングする", () => {
      const { container } = render(
        <MarkdownContent
          content={`\`\`\`
const x = 1;
\`\`\``}
        />,
      );
      const pre = container.querySelector("pre");
      expect(pre).not.toBeNull();
      const code = pre?.querySelector("code");
      expect(code).not.toBeNull();
    });

    it("箇条書き（- item）を ul > li でレンダリングする", () => {
      const { container } = render(
        <MarkdownContent
          content={`- アイテム1
- アイテム2
- アイテム3`}
        />,
      );
      const ul = container.querySelector("ul");
      expect(ul).not.toBeNull();
      const items = container.querySelectorAll("li");
      expect(items.length).toBe(3);
    });

    it("番号付きリスト（1. item）を ol > li でレンダリングする", () => {
      const { container } = render(
        <MarkdownContent
          content={`1. 最初
2. 次
3. 最後`}
        />,
      );
      const ol = container.querySelector("ol");
      expect(ol).not.toBeNull();
      const items = container.querySelectorAll("li");
      expect(items.length).toBe(3);
    });

    it("引用（> text）を blockquote 要素でレンダリングする", () => {
      const { container } = render(<MarkdownContent content="> 引用テキストです" />);
      const blockquote = container.querySelector("blockquote");
      expect(blockquote).not.toBeNull();
      expect(blockquote?.textContent).toContain("引用テキストです");
    });

    it("見出し（# text）を見出し要素でレンダリングする", () => {
      const { container } = render(<MarkdownContent content="# 見出し1" />);
      // h1〜 h6 いずれかの見出し要素が存在する
      const heading = container.querySelector("h1, h2, h3, h4, h5, h6");
      expect(heading).not.toBeNull();
      expect(heading?.textContent).toContain("見出し1");
    });

    it("リンク（[text](url)）を a 要素でレンダリングする", () => {
      const { container } = render(<MarkdownContent content="[テストリンク](https://example.com)" />);
      const link = container.querySelector("a");
      expect(link).not.toBeNull();
      expect(link?.textContent).toBe("テストリンク");
      expect(link?.getAttribute("href")).toBe("https://example.com");
    });

    it("テーブル（GFM）をレンダリングする", () => {
      const { container } = render(
        <MarkdownContent
          content={`| 列1 | 列2 |
|-----|-----|
| A   | B   |`}
        />,
      );
      const table = container.querySelector("table");
      expect(table).not.toBeNull();
    });
  });

  describe("リンクの挙動", () => {
    it("外部リンクをクリックすると外部リンク確認フローを経由する（#661: Provider 外では直接 window.open）", async () => {
      // ExternalLinkProvider なし（フォールバック）の環境では window.open を直接呼ぶ
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
      const { container } = render(<MarkdownContent content="[外部リンク](https://example.com)" />);
      const link = container.querySelector("a");
      expect(link).not.toBeNull();
      if (link) {
        await userEvent.click(link);
      }
      expect(openSpy).toHaveBeenCalledWith("https://example.com", "_blank", "noopener,noreferrer");
      openSpy.mockRestore();
    });

    it("外部リンクに href 属性が設定されている", () => {
      const { container } = render(<MarkdownContent content="[外部リンク](https://example.com)" />);
      const link = container.querySelector("a");
      expect(link?.getAttribute("href")).toBe("https://example.com");
    });
  });

  describe("画像の非表示", () => {
    it("画像（![alt](url)）は img 要素として描画しない", () => {
      const { container } = render(
        <MarkdownContent content="![テスト画像](https://example.com/image.png)" />,
      );
      const img = container.querySelector("img");
      expect(img).toBeNull();
    });
  });

  describe("XSS 防止", () => {
    it("<script> タグ要素はレンダリングされない（サニタイズ）", () => {
      const { container } = render(
        <MarkdownContent content="テキスト<script>alert('xss')</script>終わり" />,
      );
      // script 要素として DOM に存在しない（スクリプト実行不可）
      const script = container.querySelector("script");
      expect(script).toBeNull();
    });

    it("javascript: スキームの href はサニタイズされる", () => {
      const jsContent = "[悪意あるリンク](javascript:alert('xss'))";
      const { container } = render(<MarkdownContent content={jsContent} />);
      const link = container.querySelector("a");
      // リンクが存在する場合、href が javascript: スキームでないこと
      if (link) {
        const href = link.getAttribute("href") ?? "";
        expect(href.toLowerCase()).not.toContain("javascript:");
      }
      // または a タグ自体が消える
    });

    it("onerror 等のイベントハンドラ属性はサニタイズされる", () => {
      const xssContent = '<img src="x" onerror="alert(\'xss\')">';
      const { container } = render(<MarkdownContent content={xssContent} />);
      // img タグが存在する場合も onerror 属性は除去されている
      const img = container.querySelector("img");
      if (img) {
        expect(img.getAttribute("onerror")).toBeNull();
      }
      // または img タグ自体が存在しない
    });

    it("<iframe> タグはレンダリングされない", () => {
      const { container } = render(
        <MarkdownContent content='<iframe src="https://evil.com"></iframe>' />,
      );
      const iframe = container.querySelector("iframe");
      expect(iframe).toBeNull();
    });
  });

  describe("variant prop", () => {
    it("variant='body2' で描画できる（CommentCard 用）", () => {
      // エラーなく描画できることを確認
      const { container } = render(<MarkdownContent content="コメント本文です" variant="body2" />);
      expect(container).toBeInTheDocument();
      expect(screen.getByText("コメント本文です")).toBeInTheDocument();
    });

    it("variant を指定しなくてもデフォルトで描画できる", () => {
      const { container } = render(<MarkdownContent content="デフォルト本文" />);
      expect(container).toBeInTheDocument();
      expect(screen.getByText("デフォルト本文")).toBeInTheDocument();
    });
  });

  describe("clampToLines prop（一覧画面の複数行省略・#1105）", () => {
    it("clampToLines 指定時、見出し+リストなど複数ブロック要素を含んでいても出力全体を包む外側コンテナに line-clamp スタイルが適用される", () => {
      const { container } = render(
        <MarkdownContent content={"# 見出し\n\n- item1\n- item2"} clampToLines={3} />,
      );
      const heading = container.querySelector("h1");
      const list = container.querySelector("ul");
      expect(heading).not.toBeNull();
      expect(list).not.toBeNull();

      // 見出し・リストそれぞれ個別には line-clamp が付与されない
      expect(heading).not.toHaveStyle({ display: "-webkit-box" });
      expect(list).not.toHaveStyle({ display: "-webkit-box" });

      // 見出しとリスト双方を包む外側コンテナに line-clamp が適用される
      // (WebkitLineClamp は jest-dom の toHaveStyle がベンダープレフィックスプロパティを
      //  正しく比較できないため、getComputedStyle から直接検証する)
      const wrapper = container.firstElementChild as HTMLElement;
      expect(wrapper).toHaveStyle({ display: "-webkit-box", overflow: "hidden" });
      const wrapperStyle = getComputedStyle(wrapper);
      expect(wrapperStyle.getPropertyValue("-webkit-line-clamp")).toBe("3");
      expect(wrapper?.contains(heading)).toBe(true);
      expect(wrapper?.contains(list)).toBe(true);
    });

    it("clampToLines 未指定時は外側コンテナが追加されず、既存の全文表示（詳細画面）と同じ DOM のまま描画される", () => {
      const { container } = render(<MarkdownContent content={"# 見出し\n\n本文段落"} />);
      const wrapper = container.firstElementChild;
      expect(wrapper).not.toHaveStyle({ display: "-webkit-box" });
    });
  });
});
