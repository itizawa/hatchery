import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, type Mock } from "vitest";

import type { Worker } from "@hatchery/common";
import type { ReactElement } from "react";

import { useBotWorkers } from "../api/workers.js";
import { AdminWorkerTab } from "./AdminWorkerTab";

vi.mock("../api/workers.js", () => ({
  useBotWorkers: vi.fn(),
  useUploadWorkerImage: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  BOT_WORKERS_QUERY_KEY: ["workers", "bots"],
}));

const mockUseBotWorkers = useBotWorkers as Mock;

function mockWorkers(workers: Worker[] | undefined, isLoading = false) {
  mockUseBotWorkers.mockReturnValue({ data: workers, isLoading });
}

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("AdminWorkerTab", () => {
  it("アバター・表示名・役割の列ヘッダを持つ", () => {
    mockWorkers([]);
    renderWithClient(<AdminWorkerTab />);
    expect(screen.getByRole("columnheader", { name: "アバター" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "表示名" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "役割" })).toBeInTheDocument();
  });

  it("worker 配列の各行（表示名・役割）が描画される", () => {
    mockWorkers([
      { id: "haru", displayName: "haru", role: "ムードメーカー" },
      { id: "ken", displayName: "ken", role: "ベテラン" },
    ]);
    renderWithClient(<AdminWorkerTab />);
    expect(screen.getByText("haru")).toBeInTheDocument();
    expect(screen.getByText("ムードメーカー")).toBeInTheDocument();
    expect(screen.getByText("ken")).toBeInTheDocument();
    expect(screen.getByText("ベテラン")).toBeInTheDocument();
  });

  it("role 未設定のワーカーは — でフォールバック表示される", () => {
    mockWorkers([{ id: "noRole", displayName: "ノーロール" }]);
    renderWithClient(<AdminWorkerTab />);
    expect(screen.getByText("ノーロール")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("空配列のときデータ行は 0（ヘッダ行のみ）", () => {
    mockWorkers([]);
    renderWithClient(<AdminWorkerTab />);
    expect(screen.getAllByRole("row")).toHaveLength(1);
  });

  it("各行に画像アップロード導線（WorkerImageUpload）が表示される", () => {
    mockWorkers([
      { id: "haru", displayName: "haru", role: "ムードメーカー" },
      { id: "ken", displayName: "ken", role: "ベテラン" },
    ]);
    renderWithClient(<AdminWorkerTab />);
    expect(
      screen.getByRole("button", { name: "haru の画像をアップロード" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "ken の画像をアップロード" }),
    ).toBeInTheDocument();
  });

  it("imageUrl が設定された worker は画像 Avatar が表示される", () => {
    mockWorkers([
      {
        id: "haru",
        displayName: "haru",
        role: "ムードメーカー",
        imageUrl: "https://example.com/haru.png",
      },
    ]);
    renderWithClient(<AdminWorkerTab />);
    const img = screen.getByRole("img", { name: /haru/ });
    expect(img).toHaveAttribute("src", "https://example.com/haru.png");
  });

  it("imageUrl 未設定の worker はイニシャルでフォールバック表示される", () => {
    mockWorkers([{ id: "mei", displayName: "mei", role: "新人" }]);
    renderWithClient(<AdminWorkerTab />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("m")).toBeInTheDocument();
  });

  it("isLoading=true のときスケルトン行が描画される", () => {
    mockWorkers(undefined, true);
    renderWithClient(<AdminWorkerTab />);
    expect(
      screen.getAllByTestId("admin-worker-avatar-skeleton").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByTestId("admin-worker-name-skeleton").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("isLoading=true のときワーカー名は表示されない", () => {
    mockWorkers(undefined, true);
    renderWithClient(<AdminWorkerTab />);
    expect(screen.queryByText("haru")).not.toBeInTheDocument();
  });
});
