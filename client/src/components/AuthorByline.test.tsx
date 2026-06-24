import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthorByline } from "./AuthorByline";
import type { AuthorWorker } from "./AuthorByline";

const workerWithImage: AuthorWorker = {
  id: "uuid-ken",
  display_name: "ken",
  image_url: "https://example.com/ken.png",
};

const workerWithoutImage: AuthorWorker = {
  id: "uuid-mei",
  display_name: "mei",
  image_url: null,
};

describe("AuthorByline", () => {
  it("authorWorker が無いときは生の author 文字列を表示する", () => {
    render(<AuthorByline author="worker-ken" />);
    expect(screen.getByText("worker-ken")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("authorWorker.image_url が null のとき DiceBear アバター画像と display_name を表示する (#884)", () => {
    render(<AuthorByline author="uuid-mei" authorWorker={workerWithoutImage} />);
    expect(screen.getByText("mei")).toBeInTheDocument();
    const img = screen.getByRole("img", { name: "mei" });
    expect(img).toHaveAttribute("src", expect.stringContaining("api.dicebear.com"));
  });

  it("authorWorker.image_url があるとき img の src にその URL が適用される", () => {
    render(<AuthorByline author="uuid-ken" authorWorker={workerWithImage} />);
    const img = screen.getByRole("img", { name: "ken" });
    expect(img).toHaveAttribute("src", "https://example.com/ken.png");
    expect(screen.getByText("ken")).toBeInTheDocument();
  });
});
