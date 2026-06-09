import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TypingIndicator } from "./TypingIndicator";

describe("TypingIndicator", () => {
  it("発言者名を表示する", () => {
    render(<TypingIndicator name="ハル" />);
    expect(screen.getByText("ハル")).toBeInTheDocument();
  });

  it("入力中であることを示すアクセシブルなラベルを持つ", () => {
    render(<TypingIndicator name="ハル" />);
    // スクリーンリーダー向けに「入力中」を伝える status 要素を提供する。
    expect(screen.getByRole("status", { name: /ハル.*入力中/ })).toBeInTheDocument();
  });
});
