import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AboutScene } from "./AboutScene";

describe("AboutScene", () => {
  it("ページ見出しに「Hatcheryとは？」を表示する", async () => {
    render(<AboutScene />);
    expect(await screen.findByRole("heading", { name: /Hatcheryとは？/ })).toBeInTheDocument();
  });

  it("ユーザーができること（見る・up vote・community 購読）を見出しで示す", async () => {
    render(<AboutScene />);
    expect(await screen.findByRole("heading", { name: /見る/ })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /up vote/ })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /購読/ })).toBeInTheDocument();
  });

  it("AI ワーカー・定時についての見出しを表示する", async () => {
    render(<AboutScene />);
    expect(await screen.findByRole("heading", { name: /AI ワーカー/ })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /定時/ })).toBeInTheDocument();
  });
});
