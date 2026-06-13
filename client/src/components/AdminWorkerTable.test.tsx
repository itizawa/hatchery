import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Worker } from "@hatchery/common";
import type { ReactElement } from "react";

import { AdminWorkerTable } from "./AdminWorkerTable";

// AddWorkerDialog 自体は本テストの対象外（別フックを呼ぶ）ため、開閉が観測できる軽量スタブに差し替える。
vi.mock("./AddWorkerDialog.js", () => ({
  AddWorkerDialog: ({ open }: { open: boolean }) =>
    open ? <div role="dialog">AddWorkerDialog</div> : null,
}));

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** fetch をスタブして GET /api/workers の応答を制御する。 */
function stubWorkers(status: number, workers?: Worker[]) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(status, workers)));
}

/** 解決しない fetch をスタブして Suspense fallback を表示し続けさせる。 */
function stubPendingFetch() {
  vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise<Response>(() => {})));
}

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("AdminWorkerTable（useSuspenseQuery + QueryBoundary）", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("取得した worker 配列の各行（表示名・役割）が描画される", async () => {
    stubWorkers(200, [
      { id: "haru", displayName: "haru", role: "ムードメーカー" },
      { id: "ken", displayName: "ken", role: "ベテラン" },
    ] as Worker[]);
    renderWithClient(<AdminWorkerTable />);
    expect(await screen.findByText("haru")).toBeInTheDocument();
    expect(screen.getByText("ムードメーカー")).toBeInTheDocument();
    expect(screen.getByText("ken")).toBeInTheDocument();
    expect(screen.getByText("ベテラン")).toBeInTheDocument();
  });

  it("worker 数ぶんのデータ行が描画される（ヘッダ行 + データ行）", async () => {
    stubWorkers(200, [
      { id: "haru", displayName: "haru", role: "ムードメーカー" },
      { id: "ken", displayName: "ken", role: "ベテラン" },
    ] as Worker[]);
    renderWithClient(<AdminWorkerTable />);
    await screen.findByText("haru");
    expect(screen.getAllByRole("row")).toHaveLength(2 + 1);
  });

  it("空配列のときデータ行は 0（ヘッダ行のみ）", async () => {
    stubWorkers(200, []);
    renderWithClient(<AdminWorkerTable />);
    // データ解決後はスケルトン行が消え、ヘッダ行のみになる。
    await waitFor(() =>
      expect(screen.queryAllByTestId("worker-table-skeleton-item")).toHaveLength(0),
    );
    expect(screen.getAllByRole("row")).toHaveLength(1);
  });

  it("ローディング中は QueryBoundary の fallback（スケルトン）が表示される", async () => {
    stubPendingFetch();
    renderWithClient(<AdminWorkerTable />);
    await waitFor(() =>
      expect(
        screen.getAllByTestId("worker-table-skeleton-item").length,
      ).toBeGreaterThanOrEqual(1),
    );
  });

  it("取得失敗時は QueryBoundary のエラーフォールバック（再試行）が表示される", async () => {
    stubWorkers(500, undefined);
    renderWithClient(<AdminWorkerTable />);
    expect(await screen.findByRole("button", { name: "再試行" })).toBeInTheDocument();
  });

  it("「社員を追加」ボタンが表示される", async () => {
    stubWorkers(200, []);
    renderWithClient(<AdminWorkerTable />);
    expect(await screen.findByRole("button", { name: "社員を追加" })).toBeInTheDocument();
  });

  it("「社員を追加」をクリックすると AddWorkerDialog が開く", async () => {
    stubWorkers(200, []);
    renderWithClient(<AdminWorkerTable />);
    // スケルトン（fallback）解決後の本体ボタンを操作する。
    await waitFor(() =>
      expect(screen.queryAllByTestId("worker-table-skeleton-item")).toHaveLength(0),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "社員を追加" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
