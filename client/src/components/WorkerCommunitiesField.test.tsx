/**
 * WorkerCommunitiesField のローディング/エラー境界テスト（#590）。
 * `useCommunities` をモックして (a) Suspense fallback (b) ErrorBoundary errorFallback
 * (c) 成功時の描画 の 3 状態を検証する。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/communities.js", () => ({
  useCommunities: vi.fn(),
}));

import { useCommunities } from "../api/communities.js";
import { WorkerCommunitiesField } from "./WorkerCommunitiesField.js";

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const defaultProps = {
  value: [],
  onChange: vi.fn(),
  labelId: "test-label",
};

describe("WorkerCommunitiesField（#590）", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("(a) 取得中に無効化された fallback Select が表示される", () => {
    vi.mocked(useCommunities).mockImplementation(() => {
      throw new Promise<never>(() => {});
    });

    renderWithClient(<WorkerCommunitiesField {...defaultProps} />);

    const combobox = screen.getByRole("combobox", { name: /参加コミュニティ/ });
    expect(combobox).toHaveAttribute("aria-disabled", "true");
  });

  it("(b) 取得失敗時に注意 Alert（errorFallback）が表示される", () => {
    vi.mocked(useCommunities).mockImplementation(() => {
      throw new Error("fetch failed");
    });

    renderWithClient(<WorkerCommunitiesField {...defaultProps} />);

    expect(
      screen.getByText("参加コミュニティの読み込みに失敗しました。コミュニティの選択はできません。"),
    ).toBeInTheDocument();
  });

  it("(c) 成功時に内側の WorkerCommunitiesSelect が描画される", () => {
    vi.mocked(useCommunities).mockReturnValue({
      data: [{ id: "c1", slug: "tech", name: "テック", description: "d", created_at: new Date() }],
    } as ReturnType<typeof useCommunities>);

    renderWithClient(<WorkerCommunitiesField {...defaultProps} />);

    const combobox = screen.getByRole("combobox", { name: /参加コミュニティ/ });
    expect(combobox).not.toHaveAttribute("aria-disabled", "true");
  });
});
