import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PostedTime } from "./PostedTime";

describe("PostedTime", () => {
  describe("正常系: 有効な ISO 文字列を渡したとき", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // createdAt = 2026-06-01T09:00:00Z の 3 時間後を現在時刻に固定
      vi.setSystemTime(new Date("2026-06-01T12:00:00Z"));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("<time> 要素が描画される", () => {
      const { container } = render(<PostedTime createdAt="2026-06-01T09:00:00Z" />);
      expect(container.querySelector("time")).not.toBeNull();
    });

    it("dateTime 属性に ISO 形式文字列が設定される", () => {
      const { container } = render(<PostedTime createdAt="2026-06-01T09:00:00Z" />);
      const timeEl = container.querySelector("time");
      expect(timeEl).toHaveAttribute("dateTime", new Date("2026-06-01T09:00:00Z").toISOString());
    });

    it("相対時間のラベルテキスト（3時間前）が表示される", () => {
      const { container } = render(<PostedTime createdAt="2026-06-01T09:00:00Z" />);
      const timeEl = container.querySelector("time");
      expect(timeEl?.textContent).toBe("3時間前");
    });
  });

  describe("null / undefined のとき何も描画しない", () => {
    it("createdAt が null のとき <time> 要素を描画しない", () => {
      const { container } = render(<PostedTime createdAt={null} />);
      expect(container.querySelector("time")).toBeNull();
    });

    it("createdAt が undefined（prop 未指定）のとき <time> 要素を描画しない", () => {
      const { container } = render(<PostedTime />);
      expect(container.querySelector("time")).toBeNull();
    });
  });

  describe("不正な日付文字列のとき何も描画しない（例外が投げられない）", () => {
    it('createdAt が "not-a-date" のとき <time> 要素を描画しない', () => {
      expect(() => {
        const { container } = render(<PostedTime createdAt="not-a-date" />);
        expect(container.querySelector("time")).toBeNull();
      }).not.toThrow();
    });
  });
});
