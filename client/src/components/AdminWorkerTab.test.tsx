import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Worker } from "@hatchery/common";
import type { ReactElement } from "react";

import { AdminWorkerTab } from "./AdminWorkerTab";

vi.mock("../api/workers.js", async () => {
  const actual = await vi.importActual<typeof import("../api/workers.js")>("../api/workers.js");
  return {
    ...actual,
    useUploadWorkerImage: vi.fn(() => ({
      mutateAsync: vi.fn(),
      isPending: false,
    })),
  };
});

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

describe("AdminWorkerTab（useSuspenseQuery + QueryBoundary）", () => {
  beforeEach(() => {
    // 子が throw すると console.error が出るため抑制する。
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("アバター・表示名・役割の列ヘッダを持つ", async () => {
    stubWorkers(200, []);
    renderWithClient(<AdminWorkerTab />);
    expect(await screen.findByRole("columnheader", { name: "アバター" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "表示名" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "役割" })).toBeInTheDocument();
  });

  it("worker 配列の各行（表示名・役割）が描画される", async () => {
    stubWorkers(200, [
      { id: "haru", displayName: "haru", role: "ムードメーカー" },
      { id: "ken", displayName: "ken", role: "ベテラン" },
    ] as Worker[]);
    renderWithClient(<AdminWorkerTab />);
    expect(await screen.findByText("haru")).toBeInTheDocument();
    expect(screen.getByText("ムードメーカー")).toBeInTheDocument();
    expect(screen.getByText("ken")).toBeInTheDocument();
    expect(screen.getByText("ベテラン")).toBeInTheDocument();
  });

  it("role 未設定のワーカーは — でフォールバック表示される", async () => {
    stubWorkers(200, [{ id: "noRole", displayName: "ノーロール" }] as Worker[]);
    renderWithClient(<AdminWorkerTab />);
    expect(await screen.findByText("ノーロール")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("空配列のときデータ行は 0（ヘッダ行のみ）", async () => {
    stubWorkers(200, []);
    renderWithClient(<AdminWorkerTab />);
    // データ解決後はスケルトン行が消え、ヘッダ行のみになる。
    await waitFor(() =>
      expect(screen.queryAllByTestId("admin-worker-avatar-skeleton")).toHaveLength(0),
    );
    expect(screen.getAllByRole("row")).toHaveLength(1);
  });

  it("各行に画像アップロード導線（WorkerImageUpload）が表示される", async () => {
    stubWorkers(200, [
      { id: "haru", displayName: "haru", role: "ムードメーカー" },
      { id: "ken", displayName: "ken", role: "ベテラン" },
    ] as Worker[]);
    renderWithClient(<AdminWorkerTab />);
    expect(
      await screen.findByRole("button", { name: "haru の画像をアップロード" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "ken の画像をアップロード" }),
    ).toBeInTheDocument();
  });

  it("imageUrl が設定された worker は画像 Avatar が表示される", async () => {
    stubWorkers(200, [
      {
        id: "haru",
        displayName: "haru",
        role: "ムードメーカー",
        imageUrl: "https://example.com/haru.png",
      },
    ] as Worker[]);
    renderWithClient(<AdminWorkerTab />);
    const img = await screen.findByRole("img", { name: /haru/ });
    expect(img).toHaveAttribute("src", "https://example.com/haru.png");
  });

  it("imageUrl 未設定の worker はイニシャルでフォールバック表示される", async () => {
    stubWorkers(200, [{ id: "mei", displayName: "mei", role: "新人" }] as Worker[]);
    renderWithClient(<AdminWorkerTab />);
    expect(await screen.findByText("m")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("ローディング中は QueryBoundary の fallback（スケルトン）が表示される", async () => {
    stubPendingFetch();
    renderWithClient(<AdminWorkerTab />);
    await waitFor(() =>
      expect(
        screen.getAllByTestId("admin-worker-avatar-skeleton").length,
      ).toBeGreaterThanOrEqual(1),
    );
    expect(screen.queryByText("haru")).not.toBeInTheDocument();
  });

  it("取得失敗時は QueryBoundary のエラーフォールバック（再試行）が表示される", async () => {
    stubWorkers(500, { error: "Server Error" } as unknown as Worker[]);
    renderWithClient(<AdminWorkerTab />);
    expect(await screen.findByRole("button", { name: "再試行" })).toBeInTheDocument();
  });
});
