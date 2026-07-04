import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { WorkerImageUpload } from "./WorkerImageUpload.js";

const mockMutateAsync = vi.hoisted(() => vi.fn());
const mockIsPending = vi.hoisted(() => ({ value: false }));

// uploadWorkerImage をモック
vi.mock("../api/workers.js", () => ({
  useUploadWorkerImage: () => ({
    mutateAsync: mockMutateAsync,
    get isPending() {
      return mockIsPending.value;
    },
  }),
}));

describe("WorkerImageUpload（#204）", () => {
  beforeEach(() => {
    mockMutateAsync.mockResolvedValue({ id: "haru", imageUrl: "https://example.com/new.png" });
    mockIsPending.value = false;
  });

  afterEach(() => {
    mockIsPending.value = false;
  });

  it("currentImageUrl が null のとき boring-avatars で描画する (#1015)", () => {
    render(
      <WorkerImageUpload
        workerId="haru"
        displayName="haru"
        currentImageUrl={null}
      />,
    );
    const avatar = screen.getByRole("img", { name: /haru/ });
    expect(avatar).toBeInTheDocument();
    expect(avatar).not.toHaveAttribute("src");
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

  it("mutateAsync が reject した際にエラーメッセージが表示される", async () => {
    mockMutateAsync.mockRejectedValue(new Error("ネットワークエラー"));
    const { container } = render(
      <WorkerImageUpload workerId="haru" displayName="haru" currentImageUrl={null} />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["fake"], "avatar.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByText("ネットワークエラー")).toBeInTheDocument();
    });
  });

  it("isPending=true のとき CircularProgress が表示される (#1027)", () => {
    mockIsPending.value = true;
    render(
      <WorkerImageUpload workerId="haru" displayName="haru" currentImageUrl={null} />,
    );
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("isPending=true のときクリックしてもファイル選択ダイアログが開かない (#1027)", () => {
    mockIsPending.value = true;
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => undefined);
    render(
      <WorkerImageUpload workerId="haru" displayName="haru" currentImageUrl={null} />,
    );
    const button = screen.getByRole("button", { name: /haru の画像をアップロード/ });
    fireEvent.click(button);
    expect(clickSpy).not.toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});
