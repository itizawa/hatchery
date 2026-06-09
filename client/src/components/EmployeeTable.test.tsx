import { DEFAULT_EMPLOYEES } from "@hatchery/common";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EmployeeTable } from "./EmployeeTable";

// useUpdateEmployee のモック
vi.mock("../api/employees.js", () => ({
  useUpdateEmployee: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  BOT_EMPLOYEES_QUERY_KEY: ["employees", "bots"],
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

// 受け入れ条件（#25 client / コンポーネント）: common の DEFAULT_EMPLOYEES を
// 表示名・役割の列を持つテーブルとして描画する（client → common 直依存）。
describe("EmployeeTable", () => {
  it("common の DEFAULT_EMPLOYEES の表示名をすべて描画する", () => {
    renderWithClient(<EmployeeTable />);
    for (const employee of DEFAULT_EMPLOYEES) {
      expect(screen.getByText(employee.displayName)).toBeInTheDocument();
    }
  });

  it("表示名・役割の列ヘッダを持つ", () => {
    renderWithClient(<EmployeeTable />);
    expect(screen.getByRole("columnheader", { name: /表示名/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /役割/ })).toBeInTheDocument();
  });

  it("社員数ぶんの行が描画される（ヘッダ行を除く）", () => {
    renderWithClient(<EmployeeTable />);
    // tbody の行のみを数える
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(DEFAULT_EMPLOYEES.length + 1);
  });

  it("role 未設定の社員でも行が破綻せずフォールバック表示される", () => {
    const employees = [{ id: "noRole", displayName: "ノーロール" }];
    renderWithClient(<EmployeeTable employees={employees} />);
    expect(screen.getByText("ノーロール")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("isLoading=true のときスケルトン行が描画される（#241）", () => {
    renderWithClient(<EmployeeTable isLoading />);
    const skeletons = screen.getAllByTestId("employee-table-skeleton-item");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it("isLoading=true のとき社員名は表示されない（#241）", () => {
    renderWithClient(<EmployeeTable isLoading />);
    for (const employee of DEFAULT_EMPLOYEES) {
      expect(screen.queryByText(employee.displayName)).not.toBeInTheDocument();
    }
  });

  // #220: Employee の画像表示
  it("画像の列ヘッダ（画像）を持つ（#220）", () => {
    renderWithClient(<EmployeeTable />);
    expect(screen.getByRole("columnheader", { name: /画像/ })).toBeInTheDocument();
  });

  it("imageUrl が設定された Employee は Avatar として画像を表示する（#220）", () => {
    const employees = [
      {
        id: "e1",
        displayName: "テスト社員",
        isBot: true as const,
        imageUrl: "https://example.com/avatar.png",
      },
    ];
    renderWithClient(<EmployeeTable employees={employees} />);
    const img = screen.getByRole("img", { name: /テスト社員/ });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/avatar.png");
  });

  it("imageUrl 未設定の Employee はイニシャル Avatar でフォールバック表示される（#220）", () => {
    const employees = [
      { id: "e2", displayName: "フォールバック社員", isBot: true as const },
    ];
    renderWithClient(<EmployeeTable employees={employees} />);
    // displayName の先頭文字が表示される
    expect(screen.getByText("フ")).toBeInTheDocument();
  });

  it("isLoading=true のとき画像列もスケルトン表示される（#220）", () => {
    renderWithClient(<EmployeeTable isLoading />);
    const skeletons = screen.getAllByTestId("employee-table-avatar-skeleton");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  describe("編集機能（#181）", () => {
    it("isEditable=true のとき編集ボタンが表示される", () => {
      renderWithClient(<EmployeeTable isEditable />);
      const editButtons = screen.getAllByRole("button", { name: /編集/ });
      expect(editButtons).toHaveLength(DEFAULT_EMPLOYEES.length);
    });

    it("isEditable が未指定（false）のとき編集ボタンは表示されない", () => {
      renderWithClient(<EmployeeTable />);
      expect(screen.queryByRole("button", { name: /編集/ })).not.toBeInTheDocument();
    });

    it("編集ボタンをクリックすると EditEmployeeDialog が開く", () => {
      renderWithClient(<EmployeeTable isEditable />);
      const editButtons = screen.getAllByRole("button", { name: /編集/ });
      fireEvent.click(editButtons[0]);
      // ダイアログタイトルが表示されていることを確認
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });
});
