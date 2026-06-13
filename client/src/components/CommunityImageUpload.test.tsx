import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";

import { CommunityImageUpload } from "./CommunityImageUpload";

function withQuery(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>;
}

describe("CommunityImageUpload", () => {
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
});
