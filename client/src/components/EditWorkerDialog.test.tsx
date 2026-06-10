import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Worker } from "@hatchery/common";
import { WORKER_DISPLAY_NAME_MAX_LENGTH, WORKER_ROLE_MAX_LENGTH } from "@hatchery/common";

// useUpdateWorker のモック
vi.mock("../api/workers.js", () => ({
  useUpdateWorker: vi.fn(),
  BOT_WORKERS_QUERY_KEY: ["workers", "bots"],
}));

import { useUpdateWorker } from "../api/workers.js";

import { EditWorkerDialog } from "./EditWorkerDialog.js";

const mockWorker: Worker = {
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

describe("EditWorkerDialog（#181 / #329）", () => {
  it("開くとワーカーの現在値がフォームに表示される", () => {
    vi.mocked(useUpdateWorker).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as ReturnType<typeof useUpdateWorker>);

    renderWithClient(
      <EditWorkerDialog worker={mockWorker} open onClose={vi.fn()} />,
    );

    expect(screen.getByDisplayValue("ハル")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ムードメーカー")).toBeInTheDocument();
    expect(screen.getByDisplayValue("明るく元気")).toBeInTheDocument();
  });

  it("displayName の入力に maxLength=50 が設定されている", () => {
    vi.mocked(useUpdateWorker).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as ReturnType<typeof useUpdateWorker>);

    renderWithClient(
      <EditWorkerDialog worker={mockWorker} open onClose={vi.fn()} />,
    );

    const displayNameInput = screen.getByLabelText(/表示名/);
    expect(displayNameInput).toHaveAttribute("maxlength", String(WORKER_DISPLAY_NAME_MAX_LENGTH));
  });

  it("role の入力に maxLength=50 が設定されている", () => {
    vi.mocked(useUpdateWorker).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as ReturnType<typeof useUpdateWorker>);

    renderWithClient(
      <EditWorkerDialog worker={mockWorker} open onClose={vi.fn()} />,
    );

    const roleInput = screen.getByLabelText(/役割/);
    expect(roleInput).toHaveAttribute("maxlength", String(WORKER_ROLE_MAX_LENGTH));
  });

  it("personality の入力に maxLength=500 が設定されている", () => {
    vi.mocked(useUpdateWorker).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as ReturnType<typeof useUpdateWorker>);

    renderWithClient(
      <EditWorkerDialog worker={mockWorker} open onClose={vi.fn()} />,
    );

    const personalityInput = screen.getByLabelText(/性格/);
    expect(personalityInput).toHaveAttribute("maxlength", "500");
  });

  it("保存ボタンを押すと mutateAsync が呼ばれる", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useUpdateWorker).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as ReturnType<typeof useUpdateWorker>);

    renderWithClient(
      <EditWorkerDialog worker={mockWorker} open onClose={vi.fn()} />,
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
    vi.mocked(useUpdateWorker).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as ReturnType<typeof useUpdateWorker>);

    renderWithClient(
      <EditWorkerDialog worker={mockWorker} open onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /保存/ }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });
});
