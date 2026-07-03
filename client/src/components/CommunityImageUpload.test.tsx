import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";

import { CommunityImageUpload } from "./CommunityImageUpload";

const mockMutateAsync = vi.hoisted(() => vi.fn());

vi.mock("../api/communities.js", () => ({
  useUploadCommunityImage: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
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
});
