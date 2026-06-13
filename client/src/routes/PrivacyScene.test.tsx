import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PrivacyScene } from "./PrivacyScene";

describe("PrivacyScene", () => {
  it("ページ見出しに「プライバシーポリシー」を表示する", async () => {
    render(<PrivacyScene />);
    expect(await screen.findByRole("heading", { name: /プライバシーポリシー/ })).toBeInTheDocument();
  });

  it("章立て「取得する情報 / 利用目的 / 第三者提供 / 問い合わせ / 制定日」を見出しで表示する", async () => {
    render(<PrivacyScene />);
    expect(await screen.findByRole("heading", { name: /取得する情報/ })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /利用目的/ })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /第三者提供/ })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /問い合わせ/ })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /制定日/ })).toBeInTheDocument();
  });

  it("本文が暫定ドラフトである旨の注記を表示する", async () => {
    render(<PrivacyScene />);
    expect((await screen.findAllByText(/ドラフト|暫定/)).length).toBeGreaterThan(0);
  });
});
