import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Employee } from "@hatchery/common";
import { EMPLOYEE_DISPLAY_NAME_MAX_LENGTH, EMPLOYEE_ROLE_MAX_LENGTH } from "@hatchery/common";

// useUpdateEmployee のモック
vi.mock("../api/employees.js", () => ({
  useUpdateEmployee: vi.fn(),
  BOT_EMPLOYEES_QUERY_KEY: ["employees", "bots"],
}));

import { useUpdateEmployee } from "../api/employees.js";

import { EditEmployeeDialog } from "./EditEmployeeDialog.js";

const mockEmployee: Employee = {
  id: "haru",
  displayName: "ハル",
  role: "ムードメーカー",
  isBot: true,
  personality: "明るく元気",
};

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("EditEmployeeDialog（#181）", () => {
  it("開くとワーカーの現在値がフォームに表示される", () => {
    vi.mocked(useUpdateEmployee).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as ReturnType<typeof useUpdateEmployee>);

    renderWithClient(
      <EditEmployeeDialog employee={mockEmployee} open onClose={vi.fn()} />,
    );

    expect(screen.getByDisplayValue("ハル")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ムードメーカー")).toBeInTheDocument();
    expect(screen.getByDisplayValue("明るく元気")).toBeInTheDocument();
  });

  it("displayName の入力に maxLength=50 が設定されている", () => {
    vi.mocked(useUpdateEmployee).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as ReturnType<typeof useUpdateEmployee>);

    renderWithClient(
      <EditEmployeeDialog employee={mockEmployee} open onClose={vi.fn()} />,
    );

    const displayNameInput = screen.getByLabelText(/表示名/);
    expect(displayNameInput).toHaveAttribute("maxlength", String(EMPLOYEE_DISPLAY_NAME_MAX_LENGTH));
  });

  it("role の入力に maxLength=50 が設定されている", () => {
    vi.mocked(useUpdateEmployee).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as ReturnType<typeof useUpdateEmployee>);

    renderWithClient(
      <EditEmployeeDialog employee={mockEmployee} open onClose={vi.fn()} />,
    );

    const roleInput = screen.getByLabelText(/役割/);
    expect(roleInput).toHaveAttribute("maxlength", String(EMPLOYEE_ROLE_MAX_LENGTH));
  });

  it("personality の入力に maxLength=500 が設定されている", () => {
    vi.mocked(useUpdateEmployee).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as ReturnType<typeof useUpdateEmployee>);

    renderWithClient(
      <EditEmployeeDialog employee={mockEmployee} open onClose={vi.fn()} />,
    );

    const personalityInput = screen.getByLabelText(/性格/);
    expect(personalityInput).toHaveAttribute("maxlength", "500");
  });

  it("保存ボタンを押すと mutateAsync が呼ばれる", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useUpdateEmployee).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as ReturnType<typeof useUpdateEmployee>);

    renderWithClient(
      <EditEmployeeDialog employee={mockEmployee} open onClose={vi.fn()} />,
    );

    const saveButton = screen.getByRole("button", { name: /保存/ });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        id: "haru",
        body: {
          displayName: "ハル",
          role: "ムードメーカー",
          personality: "明るく元気",
        },
      });
    });
  });

  it("保存成功後に onClose が呼ばれる", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    vi.mocked(useUpdateEmployee).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as ReturnType<typeof useUpdateEmployee>);

    renderWithClient(
      <EditEmployeeDialog employee={mockEmployee} open onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /保存/ }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });
});
