import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_DOCUMENT_TITLE, useDocumentTitle } from "./useDocumentTitle.js";

// 受け入れ条件 #256-3/4: コミュニティ名でタブタイトルを動的更新するフック
describe("useDocumentTitle (#256)", () => {
  beforeEach(() => {
    document.title = DEFAULT_DOCUMENT_TITLE;
  });
  afterEach(() => {
    document.title = DEFAULT_DOCUMENT_TITLE;
  });

  it("文字列を渡すと document.title がその値になる", () => {
    renderHook(() => useDocumentTitle("テックトーク - Hatchery"));
    expect(document.title).toBe("テックトーク - Hatchery");
  });

  it("空文字を渡すと document.title が既定（Hatchery）になる", () => {
    renderHook(() => useDocumentTitle(""));
    expect(document.title).toBe(DEFAULT_DOCUMENT_TITLE);
  });

  it("undefined を渡すと document.title が既定（Hatchery）になる", () => {
    renderHook(() => useDocumentTitle(undefined));
    expect(document.title).toBe(DEFAULT_DOCUMENT_TITLE);
  });

  it("アンマウント後に document.title が既定（Hatchery）へ戻る", () => {
    const { unmount } = renderHook(() => useDocumentTitle("テックトーク - Hatchery"));
    expect(document.title).toBe("テックトーク - Hatchery");
    unmount();
    expect(document.title).toBe(DEFAULT_DOCUMENT_TITLE);
  });

  it("title が更新されると document.title も追従する", () => {
    const { rerender } = renderHook(({ title }: { title: string }) => useDocumentTitle(title), {
      initialProps: { title: "A - Hatchery" },
    });
    expect(document.title).toBe("A - Hatchery");
    rerender({ title: "B - Hatchery" });
    expect(document.title).toBe("B - Hatchery");
  });
});
