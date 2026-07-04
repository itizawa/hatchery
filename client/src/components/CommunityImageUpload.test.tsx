import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { ReactElement } from "react";

import { CommunityImageUpload } from "./CommunityImageUpload";

const mockMutateAsync = vi.hoisted(() => vi.fn());
const mockIsPending = vi.hoisted(() => ({ value: false }));

vi.mock("../api/communities.js", () => ({
  useUploadCommunityImage: () => ({
    mutateAsync: mockMutateAsync,
    get isPending() {
      return mockIsPending.value;
    },
  }),
}));

function withQuery(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>;
}

describe("CommunityImageUpload", () => {
  beforeEach(() => {
    mockMutateAsync.mockResolvedValue({
      id: "comm-1",
      iconUrl: "https://example.com/icon.png",
      coverUrl: null,
    });
    mockIsPending.value = false;
  });

  afterEach(() => {
    mockIsPending.value = false;
  });

  it("kind=icon のときアップロードボタン（label）を描画する", () => {
    render(
      withQuery(
        <CommunityImageUpload
          communityId="comm-1"
          kind="icon"
          name="テクノロジー"
          currentImageUrl={null}
        />,
      ),
    );
    expect(
      screen.getByRole("button", { name: /テクノロジー のアイコン画像をアップロード/ }),
    ).toBeInTheDocument();
  });

  it("kind=cover のときアップロードボタン（label）を描画する", () => {
    render(
      withQuery(
        <CommunityImageUpload
          communityId="comm-1"
          kind="cover"
          name="テクノロジー"
          currentImageUrl={null}
        />,
      ),
    );
    expect(
      screen.getByRole("button", { name: /テクノロジー のカバー画像をアップロード/ }),
    ).toBeInTheDocument();
  });

  it("currentImageUrl があれば img として表示する", () => {
    render(
      withQuery(
        <CommunityImageUpload
          communityId="comm-1"
          kind="icon"
          name="テクノロジー"
          currentImageUrl="https://example.com/icon.png"
        />,
      ),
    );
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://example.com/icon.png");
  });

  it("画像未設定でもクラッシュせず描画する（プレースホルダ）", () => {
    const { container } = render(
      withQuery(
        <CommunityImageUpload
          communityId="comm-1"
          kind="cover"
          name="テクノロジー"
          currentImageUrl={null}
        />,
      ),
    );
    expect(container).toBeInTheDocument();
  });

  it("mutateAsync が reject した際にエラーメッセージが表示される", async () => {
    mockMutateAsync.mockRejectedValue(new Error("画像のアップロードに失敗しました"));
    const { container } = render(
      withQuery(
        <CommunityImageUpload
          communityId="comm-1"
          kind="icon"
          name="テクノロジー"
          currentImageUrl={null}
        />,
      ),
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["fake"], "icon.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByText("画像のアップロードに失敗しました")).toBeInTheDocument();
    });
  });

  it("ファイル選択で mutateAsync が正しい引数で呼ばれ onSuccess が呼ばれる (#1027)", async () => {
    const onSuccess = vi.fn();
    const { container } = render(
      withQuery(
        <CommunityImageUpload
          communityId="comm-1"
          kind="icon"
          name="テクノロジー"
          currentImageUrl={null}
          onSuccess={onSuccess}
        />,
      ),
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["fake"], "icon.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        communityId: "comm-1",
        kind: "icon",
        file,
      });
      expect(onSuccess).toHaveBeenCalledWith({
        id: "comm-1",
        iconUrl: "https://example.com/icon.png",
        coverUrl: null,
      });
    });
  });

  it("isPending=true のとき CircularProgress が表示される (#1027)", () => {
    mockIsPending.value = true;
    render(
      withQuery(
        <CommunityImageUpload
          communityId="comm-1"
          kind="icon"
          name="テクノロジー"
          currentImageUrl={null}
        />,
      ),
    );
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("isPending=true のときクリックしてもファイル選択ダイアログが開かない (#1027)", () => {
    mockIsPending.value = true;
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => undefined);
    render(
      withQuery(
        <CommunityImageUpload
          communityId="comm-1"
          kind="icon"
          name="テクノロジー"
          currentImageUrl={null}
        />,
      ),
    );
    const button = screen.getByRole("button", { name: /テクノロジー のアイコン画像をアップロード/ });
    fireEvent.click(button);
    expect(clickSpy).not.toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});
