import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WorkerAvatar } from "./WorkerAvatar.js";

describe("WorkerAvatar (#1015)", () => {
  it("imageUrl が非 null のとき MUI Avatar が src 付きで描画される", () => {
    render(
      <WorkerAvatar
        id="worker-1"
        imageUrl="https://example.com/avatar.png"
        size={32}
        alt="テストワーカー"
        displayName="テスト"
      />,
    );
    const img = screen.getByRole("img", { name: "テストワーカー" });
    expect(img).toHaveAttribute("src", "https://example.com/avatar.png");
  });

  it("imageUrl が null のとき boring-avatars SVG を描画し img タグを出さない (#1015)", () => {
    render(
      <WorkerAvatar
        id="worker-1"
        imageUrl={null}
        size={32}
        alt="テストワーカー"
        displayName="テスト"
      />,
    );
    const avatar = screen.getByRole("img", { name: "テストワーカー" });
    expect(avatar).toBeInTheDocument();
    expect(avatar).not.toHaveAttribute("src");
    expect(document.querySelector("img")).toBeNull();
  });

  it("imageUrl が undefined のとき boring-avatars SVG を描画する", () => {
    render(
      <WorkerAvatar
        id="worker-2"
        size={24}
        alt="ワーカー2"
      />,
    );
    const avatar = screen.getByRole("img", { name: "ワーカー2" });
    expect(avatar).toBeInTheDocument();
    expect(avatar).not.toHaveAttribute("src");
  });

  it("同じ id を渡すと同じ SVG 構造になる（決定的）", () => {
    const normalize = (html: string | undefined) =>
      html?.replace(/_r_\d+_/g, "_r_X_") ?? "";

    const { container: c1 } = render(<WorkerAvatar id="same-id" size={32} />);
    const svg1 = normalize(c1.querySelector("svg")?.innerHTML);

    const { container: c2 } = render(<WorkerAvatar id="same-id" size={32} />);
    const svg2 = normalize(c2.querySelector("svg")?.innerHTML);

    expect(svg1).toBe(svg2);
  });
});
