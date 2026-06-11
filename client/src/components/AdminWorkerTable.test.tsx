import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, type Mock } from "vitest";

import type { Worker } from "@hatchery/common";
import type { ReactElement } from "react";

import { useAdminWorkers } from "../api/admin.js";
import { AdminWorkerTable } from "./AdminWorkerTable";

vi.mock("../api/admin.js", () => ({
  useAdminWorkers: vi.fn(),
  useCreateAdminWorker: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
}));

vi.mock("../api/workers.js", () => ({
  useUpdateWorker: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  BOT_WORKERS_QUERY_KEY: ["workers", "bots"],
}));

const mockUseAdminWorkers = useAdminWorkers as Mock;

function mockWorkers(workers: Worker[] | undefined, isLoading = false) {
  mockUseAdminWorkers.mockReturnValue({ data: workers, isLoading });
}

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("AdminWorkerTable", () => {
  it("取得した worker 配列の各行（表示名・役割）が描画される", () => {
    mockWorkers([
      { id: "haru", displayName: "haru", role: "ムードメーカー" },
      { id: "ken", displayName: "ken", role: "ベテラン" },
    ]);
    renderWithClient(<AdminWorkerTable />);
    expect(screen.getByText("haru")).toBeInTheDocument();
    expect(screen.getByText("ムードメーカー")).toBeInTheDocument();
    expect(screen.getByText("ken")).toBeInTheDocument();
    expect(screen.getByText("ベテラン")).toBeInTheDocument();
  });

  it("worker 数ぶんのデータ行が描画される（ヘッダ行 + データ行）", () => {
    mockWorkers([
      { id: "haru", displayName: "haru", role: "ムードメーカー" },
      { id: "ken", displayName: "ken", role: "ベテラン" },
    ]);
    renderWithClient(<AdminWorkerTable />);
    expect(screen.getAllByRole("row")).toHaveLength(2 + 1);
  });

  it("空配列のときデータ行は 0（ヘッダ行のみ）", () => {
    mockWorkers([]);
    renderWithClient(<AdminWorkerTable />);
    expect(screen.getAllByRole("row")).toHaveLength(1);
  });

  it("isLoading=true のときスケルトン行が描画される", () => {
    mockWorkers(undefined, true);
    renderWithClient(<AdminWorkerTable />);
    expect(screen.getAllByTestId("worker-table-skeleton-item").length).toBeGreaterThanOrEqual(1);
  });

  it("「社員を追加」ボタンが表示される", () => {
    mockWorkers([]);
    renderWithClient(<AdminWorkerTable />);
    expect(screen.getByRole("button", { name: "社員を追加" })).toBeInTheDocument();
  });

  it("「社員を追加」をクリックすると AddWorkerDialog が開く", async () => {
    mockWorkers([]);
    renderWithClient(<AdminWorkerTable />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "社員を追加" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
