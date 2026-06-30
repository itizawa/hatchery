import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkerImageUpload } from "./WorkerImageUpload.js";

// uploadWorkerImage をモック
vi.mock("../api/workers.js", () => ({
  useUploadWorkerImage: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: "haru", imageUrl: "https://example.com/new.png" }),
    isPending: false,
  }),
}));

describe("WorkerImageUpload（#204）", () => {
  it("currentImageUrl が null のとき Boring Avatars アバター画像を表示する (#884)", () => {
    render(
      <WorkerImageUpload
        workerId="haru"
        displayName="haru"
        currentImageUrl={null}
      />,
    );
    const img = screen.getByRole("img", { name: /haru/ });
    expect(img).toHaveAttribute("src", expect.stringContaining("source.boringavatars.com"));
  });

  it("imageUrl が設定されている場合は画像 Avatar が表示される", () => {
    render(
      <WorkerImageUpload
        workerId="haru"
        displayName="haru"
        currentImageUrl="https://example.com/avatar.png"
      />,
    );
    const img = screen.getByRole("img", { name: /haru/ });
    expect(img).toHaveAttribute("src", "https://example.com/avatar.png");
  });

  it("ファイル入力が hidden で存在する", () => {
    const { container } = render(
      <WorkerImageUpload
        workerId="haru"
        displayName="haru"
        currentImageUrl={null}
      />,
    );
    const input = container.querySelector('input[type="file"]');
    expect(input).toBeInTheDocument();
  });

  it("有効な画像ファイルを選択すると onSuccess が呼ばれる", async () => {
    const onSuccess = vi.fn();
    const { container } = render(
      <WorkerImageUpload
        workerId="haru"
        displayName="haru"
        currentImageUrl={null}
        onSuccess={onSuccess}
      />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["fake"], "avatar.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith({
        id: "haru",
        imageUrl: "https://example.com/new.png",
      });
    });
  });
});
