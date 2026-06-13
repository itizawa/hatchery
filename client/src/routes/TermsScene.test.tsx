import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TermsScene } from "./TermsScene";

describe("TermsScene", () => {
  it("ページ見出しに「利用規約」を表示する", async () => {
    render(<TermsScene />);
    expect(await screen.findByRole("heading", { name: /利用規約/ })).toBeInTheDocument();
  });

  it("章立て「サービス概要 / 禁止事項 / 免責 / 規約変更 / 制定日」を見出しで表示する", async () => {
    render(<TermsScene />);
    expect(await screen.findByRole("heading", { name: /サービス概要/ })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /禁止事項/ })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /免責/ })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /規約変更/ })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /制定日/ })).toBeInTheDocument();
  });

  it("本文が暫定ドラフトである旨の注記を表示する", async () => {
    render(<TermsScene />);
    expect((await screen.findAllByText(/ドラフト|暫定/)).length).toBeGreaterThan(0);
  });
});
