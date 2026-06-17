import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type React from "react";

import { NotFoundScene } from "./NotFoundScene";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  };
});

describe("NotFoundScene (#529)", () => {
  it("「ページが見つかりません」を表示する", async () => {
    render(<NotFoundScene />);
    expect(await screen.findByText(/ページが見つかりません/)).toBeInTheDocument();
  });

  it("ホーム（/）へのリンクが表示される", async () => {
    render(<NotFoundScene />);
    const homeLink = await screen.findByRole("link", { name: /ホームへ戻る/ });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute("href", "/");
  });
});
