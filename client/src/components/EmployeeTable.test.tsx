import { DEFAULT_EMPLOYEES } from "@hatchery/common";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmployeeTable } from "./EmployeeTable";

// 受け入れ条件（#25 client / コンポーネント）: common の DEFAULT_EMPLOYEES を
// 表示名・役割の列を持つテーブルとして描画する（client → common 直依存）。
describe("EmployeeTable", () => {
  it("common の DEFAULT_EMPLOYEES の表示名をすべて描画する", () => {
    render(<EmployeeTable />);
    for (const employee of DEFAULT_EMPLOYEES) {
      expect(screen.getByText(employee.displayName)).toBeInTheDocument();
    }
  });

  it("表示名・役割の列ヘッダを持つ", () => {
    render(<EmployeeTable />);
    expect(screen.getByRole("columnheader", { name: /表示名/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /役割/ })).toBeInTheDocument();
  });

  it("社員数ぶんの行が描画される（ヘッダ行を除く）", () => {
    render(<EmployeeTable />);
    // tbody の行のみを数える
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(DEFAULT_EMPLOYEES.length + 1);
  });

  it("role 未設定の社員でも行が破綻せずフォールバック表示される", () => {
    const employees = [{ id: "noRole", displayName: "ノーロール" }];
    render(<EmployeeTable employees={employees} />);
    expect(screen.getByText("ノーロール")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("isLoading=true のときスケルトン行が描画される（#241）", () => {
    render(<EmployeeTable isLoading />);
    const skeletons = screen.getAllByTestId("employee-table-skeleton-item");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it("isLoading=true のとき社員名は表示されない（#241）", () => {
    render(<EmployeeTable isLoading />);
    for (const employee of DEFAULT_EMPLOYEES) {
      expect(screen.queryByText(employee.displayName)).not.toBeInTheDocument();
    }
  });
});
