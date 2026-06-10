import { DEFAULT_WORKERS } from "@hatchery/common";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WorkerTable } from "./WorkerTable";

vi.mock("../api/workers.js", () => ({
  useUpdateWorker: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  BOT_WORKERS_QUERY_KEY: ["workers", "bots"],
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("WorkerTable", () => {
  it("common の DEFAULT_WORKERS の表示名をすべて描画する", () => {
    renderWithClient(<WorkerTable />);
    for (const worker of DEFAULT_WORKERS) {
      expect(screen.getByText(worker.displayName)).toBeInTheDocument();
    }
  });

  it("表示名・役割の列ヘッダを持つ", () => {
    renderWithClient(<WorkerTable />);
    expect(screen.getByRole("columnheader", { name: /表示名/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /役割/ })).toBeInTheDocument();
  });

  it("ワーカー数ぶんの行が描画される（ヘッダ行を除く）", () => {
    renderWithClient(<WorkerTable />);
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(DEFAULT_WORKERS.length + 1);
  });

  it("role 未設定のワーカーでも行が破綻せずフォールバック表示される", () => {
    const workers = [{ id: "noRole", displayName: "ノーロール" }];
    renderWithClient(<WorkerTable workers={workers} />);
    expect(screen.getByText("ノーロール")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("isLoading=true のときスケルトン行が描画される（#241）", () => {
    renderWithClient(<WorkerTable isLoading />);
    const skeletons = screen.getAllByTestId("worker-table-skeleton-item");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it("isLoading=true のときワーカー名は表示されない（#241）", () => {
    renderWithClient(<WorkerTable isLoading />);
    for (const worker of DEFAULT_WORKERS) {
      expect(screen.queryByText(worker.displayName)).not.toBeInTheDocument();
    }
  });

  it("画像の列ヘッダ（画像）を持つ（#220）", () => {
    renderWithClient(<WorkerTable />);
    expect(screen.getByRole("columnheader", { name: /画像/ })).toBeInTheDocument();
  });

  it("imageUrl が設定された Worker は Avatar として画像を表示する（#220）", () => {
    const workers = [
      { id: "w1", displayName: "テストワーカー", imageUrl: "https://example.com/avatar.png" },
    ];
    renderWithClient(<WorkerTable workers={workers} />);
    const img = screen.getByRole("img", { name: /テストワーカー/ });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/avatar.png");
  });

  it("imageUrl 未設定の Worker はイニシャル Avatar でフォールバック表示される（#220）", () => {
    const workers = [{ id: "w2", displayName: "フォールバックワーカー" }];
    renderWithClient(<WorkerTable workers={workers} />);
    expect(screen.getByText("フ")).toBeInTheDocument();
  });

  it("isLoading=true のとき画像列もスケルトン表示される（#220）", () => {
    renderWithClient(<WorkerTable isLoading />);
    const skeletons = screen.getAllByTestId("worker-table-avatar-skeleton");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  describe("編集機能（#181）", () => {
    it("isEditable=true のとき編集ボタンが表示される", () => {
      renderWithClient(<WorkerTable isEditable />);
      const editButtons = screen.getAllByRole("button", { name: /編集/ });
      expect(editButtons).toHaveLength(DEFAULT_WORKERS.length);
    });

    it("isEditable が未指定（false）のとき編集ボタンは表示されない", () => {
      renderWithClient(<WorkerTable />);
      expect(screen.queryByRole("button", { name: /編集/ })).not.toBeInTheDocument();
    });

    it("編集ボタンをクリックすると EditWorkerDialog が開く", () => {
      renderWithClient(<WorkerTable isEditable />);
      const editButtons = screen.getAllByRole("button", { name: /編集/ });
      fireEvent.click(editButtons[0]);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("onDelete プロップがある場合は削除ボタンが表示される（#218）", () => {
    const handleDelete = vi.fn();
    renderWithClient(<WorkerTable onDelete={handleDelete} />);
    const deleteButtons = screen.getAllByRole("button", { name: /削除/ });
    expect(deleteButtons).toHaveLength(DEFAULT_WORKERS.length);
  });

  it("onDelete プロップがない場合は削除ボタンが表示されない（#218）", () => {
    renderWithClient(<WorkerTable />);
    const deleteButtons = screen.queryAllByRole("button", { name: /削除/ });
    expect(deleteButtons).toHaveLength(0);
  });

  it("削除ボタンをクリックすると確認ダイアログが開く（#218）", async () => {
    const handleDelete = vi.fn();
    renderWithClient(<WorkerTable onDelete={handleDelete} />);
    const deleteButtons = screen.getAllByRole("button", { name: /削除/ });
    await userEvent.click(deleteButtons[0]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("確認ダイアログで「削除する」をクリックすると onDelete が呼ばれる（#218）", async () => {
    const handleDelete = vi.fn();
    const workers = [{ id: "emp-1", displayName: "田中 太郎" }];
    renderWithClient(<WorkerTable workers={workers} onDelete={handleDelete} />);
    const deleteButton = screen.getByRole("button", { name: /削除/ });
    await userEvent.click(deleteButton);
    const confirmButton = screen.getByRole("button", { name: /削除する/ });
    await userEvent.click(confirmButton);
    expect(handleDelete).toHaveBeenCalledWith("emp-1");
  });

  it("確認ダイアログで「キャンセル」をクリックすると onDelete は呼ばれない（#218）", async () => {
    const handleDelete = vi.fn();
    renderWithClient(<WorkerTable onDelete={handleDelete} />);
    const deleteButtons = screen.getAllByRole("button", { name: /削除/ });
    await userEvent.click(deleteButtons[0]);
    const cancelButton = screen.getByRole("button", { name: /キャンセル/ });
    await userEvent.click(cancelButton);
    expect(handleDelete).not.toHaveBeenCalled();
  });
});
