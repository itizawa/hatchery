import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_WORKERS } from "@hatchery/common";

import { WorkerTable } from "./WorkerTable";

const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe("WorkerTable", () => {
  it("ワーカーの表示名をリスト表示する", () => {
    renderWithClient(<WorkerTable />);
    for (const worker of DEFAULT_WORKERS) {
      expect(screen.getByText(worker.displayName)).toBeInTheDocument();
    }
  });

  it("ワーカーの role を表示する", () => {
    renderWithClient(<WorkerTable />);
    for (const worker of DEFAULT_WORKERS) {
      if (worker.role) {
        expect(screen.getByText(worker.role)).toBeInTheDocument();
      }
    }
  });

  it("ワーカーが指定されないときは DEFAULT_WORKERS を表示する", () => {
    renderWithClient(<WorkerTable />);
    expect(screen.getByText(DEFAULT_WORKERS[0].displayName)).toBeInTheDocument();
  });

  it("workers props でカスタムリストを渡せる", () => {
    const workers = [{ id: "w1", displayName: "カスタムワーカー" }];
    renderWithClient(<WorkerTable workers={workers} />);
    expect(screen.getByText("カスタムワーカー")).toBeInTheDocument();
  });

  it("削除済みワーカーは》削除済み《プレフィックス付きで表示名を表示する（#218）", () => {
    const workers = [{ id: "del", displayName: "削除ワーカー", deletedAt: "2024-01-01T00:00:00.000Z" }];
    renderWithClient(<WorkerTable workers={workers} />);
    expect(screen.getByText("》削除済み《削除ワーカー")).toBeInTheDocument();
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

  it("imageUrl 未設定の Worker は Boring Avatars アバター画像を表示する (#884)", () => {
    const workers = [{ id: "w2", displayName: "フォールバックワーカー" }];
    renderWithClient(<WorkerTable workers={workers} />);
    const img = screen.getByRole("img", { name: "フォールバックワーカー" });
    expect(img).toHaveAttribute("src", expect.stringContaining("source.boringavatars.com"));
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

    it("isEditable=true のときワーカー名列も表示される（両立する）", () => {
      renderWithClient(<WorkerTable isEditable />);
      expect(screen.getByText(DEFAULT_WORKERS[0].displayName)).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: /編集/ }).length).toBeGreaterThan(0);
    });

    it("編集ボタンをクリックすると /admin/workers/$workerId/edit へ遷移する（#888）", async () => {
      renderWithClient(<WorkerTable isEditable />);
      const editButtons = screen.getAllByRole("button", { name: /編集/ });
      await userEvent.click(editButtons[0]);
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/admin/workers/$workerId/edit",
        params: { workerId: DEFAULT_WORKERS[0].id },
      });
    });
  });

  describe("削除機能（#219）", () => {
    it("onDelete が指定されたとき削除ボタンが表示される", () => {
      renderWithClient(<WorkerTable onDelete={vi.fn()} />);
      const deleteButtons = screen.getAllByRole("button", { name: /削除/ });
      expect(deleteButtons).toHaveLength(DEFAULT_WORKERS.length);
    });

    it("onDelete が未指定のとき削除ボタンは表示されない", () => {
      renderWithClient(<WorkerTable />);
      expect(screen.queryByRole("button", { name: /削除/ })).not.toBeInTheDocument();
    });

    it("削除ボタンをクリックするとダイアログが表示される", async () => {
      renderWithClient(<WorkerTable onDelete={vi.fn()} />);
      const deleteButtons = screen.getAllByRole("button", { name: /削除/ });
      await userEvent.click(deleteButtons[0]);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("ダイアログの確定ボタンをクリックすると onDelete コールバックが呼ばれる", async () => {
      const onDelete = vi.fn().mockResolvedValue(undefined);
      renderWithClient(<WorkerTable onDelete={onDelete} />);
      const deleteButtons = screen.getAllByRole("button", { name: /削除/ });
      await userEvent.click(deleteButtons[0]);
      const confirmButton = screen.getByRole("button", { name: "削除する" });
      await userEvent.click(confirmButton);
      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onDelete).toHaveBeenCalledWith(DEFAULT_WORKERS[0].id);
    });

    it("削除ダイアログにワーカー名が表示される", async () => {
      renderWithClient(<WorkerTable onDelete={vi.fn()} />);
      const deleteButtons = screen.getAllByRole("button", { name: /削除/ });
      await userEvent.click(deleteButtons[0]);
      expect(screen.getByText(DEFAULT_WORKERS[0].displayName)).toBeInTheDocument();
    });

    it("削除ダイアログのキャンセルボタンでダイアログが閉じる", async () => {
      renderWithClient(<WorkerTable onDelete={vi.fn()} />);
      const deleteButtons = screen.getAllByRole("button", { name: /削除/ });
      await userEvent.click(deleteButtons[0]);
      const cancelButton = screen.getByRole("button", { name: /キャンセル/ });
      await userEvent.click(cancelButton);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("削除済みワーカーは》削除済み《プレフィックス付きダイアログメッセージを表示する (#884)", async () => {
      const deletedWorker = { id: "del", displayName: "削除ワーカー", deletedAt: "2024-01-01T00:00:00.000Z" };
      renderWithClient(<WorkerTable onDelete={vi.fn()} workers={[deletedWorker]} />);
      const deleteButtons = screen.getAllByRole("button", { name: /削除/ });
      await userEvent.click(deleteButtons[0]);
      expect(screen.getByText("》削除済み《削除ワーカー")).toBeInTheDocument();
    });
  });
});
