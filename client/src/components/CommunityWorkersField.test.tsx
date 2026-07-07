/**
 * CommunityWorkersField のローディング/エラー境界テスト（#1079）。
 * `useBotWorkers` をモックして (a) Suspense fallback (b) ErrorBoundary errorFallback
 * (c) 成功時の描画 の 3 状態を検証する。`WorkerCommunitiesField.test.tsx`（#590）と対称。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/workers.js", () => ({
  useBotWorkers: vi.fn(),
}));

import { useBotWorkers } from "../api/workers.js";
import { CommunityWorkersField } from "./CommunityWorkersField.js";

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const defaultProps = {
  value: [],
  onChange: vi.fn(),
  labelId: "test-label",
};

describe("CommunityWorkersField（#1079）", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("(a) 取得中に無効化された fallback Select が表示される", () => {
    vi.mocked(useBotWorkers).mockImplementation(() => {
      throw new Promise<never>(() => {});
    });

    renderWithClient(<CommunityWorkersField {...defaultProps} />);

    const combobox = screen.getByRole("combobox", { name: /所属ワーカー/ });
    expect(combobox).toHaveAttribute("aria-disabled", "true");
  });

  it("(b) 取得失敗時に注意 Alert（errorFallback）が表示される", () => {
    vi.mocked(useBotWorkers).mockImplementation(() => {
      throw new Error("fetch failed");
    });

    renderWithClient(<CommunityWorkersField {...defaultProps} />);

    expect(
      screen.getByText("所属ワーカーの選択肢の読み込みに失敗しました。ワーカーの選択はできません。"),
    ).toBeInTheDocument();
  });

  it("(c) 成功時に内側の CommunityWorkersSelect が描画される", () => {
    vi.mocked(useBotWorkers).mockReturnValue({
      data: [{ id: "w1", displayName: "haru" }],
    } as ReturnType<typeof useBotWorkers>);

    renderWithClient(<CommunityWorkersField {...defaultProps} />);

    const combobox = screen.getByRole("combobox", { name: /所属ワーカー/ });
    expect(combobox).not.toHaveAttribute("aria-disabled", "true");
  });
});
