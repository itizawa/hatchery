/**
 * AddWorkerScene のレンダリングテスト（#888）。
 * ワーカー作成ページ（/admin/workers/new）のフォーム表示と送信動作を検証する。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type React from "react";

// useNavigate / Link をモックする
const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ children, to, search }: { children: React.ReactNode; to: string; search?: unknown }) => (
      <a href={search ? `${to}?${new URLSearchParams(search as Record<string, string>).toString()}` : to}>{children}</a>
    ),
  };
});

vi.mock("../api/admin.js", () => ({
  useCreateAdminWorker: vi.fn(),
}));

vi.mock("../api/workerCommunities.js", () => ({
  useSetWorkerCommunities: vi.fn(),
}));

vi.mock("../api/communities.js", () => ({
  useCommunities: vi.fn(),
}));

import { useCreateAdminWorker } from "../api/admin.js";
import { useSetWorkerCommunities } from "../api/workerCommunities.js";
import { useCommunities } from "../api/communities.js";
import { AddWorkerScene } from "./AddWorkerScene.js";

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function stubAll(opts?: {
  createMutateAsync?: ReturnType<typeof vi.fn>;
  setMutateAsync?: ReturnType<typeof vi.fn>;
}) {
  vi.mocked(useCreateAdminWorker).mockReturnValue({
    mutateAsync: opts?.createMutateAsync ?? vi.fn().mockResolvedValue({ id: "new-worker-id", displayName: "テスト" }),
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useCreateAdminWorker>);

  vi.mocked(useSetWorkerCommunities).mockReturnValue({
    mutateAsync: opts?.setMutateAsync ?? vi.fn().mockResolvedValue({ communityIds: [] }),
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useSetWorkerCommunities>);

  vi.mocked(useCommunities).mockReturnValue({
    data: [],
    isLoading: false,
  } as ReturnType<typeof useCommunities>);
}

describe("AddWorkerScene（#888）", () => {
  it("ページタイトル「ワーカーを追加」が表示される", () => {
    stubAll();
    renderWithClient(<AddWorkerScene />);
    expect(screen.getByRole("heading", { name: "ワーカーを追加" })).toBeInTheDocument();
  });

  it("表示名の入力欄が表示される", () => {
    stubAll();
    renderWithClient(<AddWorkerScene />);
    expect(screen.getByRole("textbox", { name: "表示名" })).toBeInTheDocument();
  });

  it("役割の入力欄が表示される", () => {
    stubAll();
    renderWithClient(<AddWorkerScene />);
    expect(screen.getByRole("textbox", { name: /役割/ })).toBeInTheDocument();
  });

  it("参加コミュニティの選択 UI が表示される", () => {
    stubAll();
    renderWithClient(<AddWorkerScene />);
    expect(screen.getByLabelText(/参加コミュニティ/)).toBeInTheDocument();
  });

  it("表示名が空のとき追加ボタンは disabled になる", () => {
    stubAll();
    renderWithClient(<AddWorkerScene />);
    expect(screen.getByRole("button", { name: "追加" })).toBeDisabled();
  });

  it("表示名を入力すると追加ボタンが有効になる", async () => {
    stubAll();
    renderWithClient(<AddWorkerScene />);
    await userEvent.type(screen.getByRole("textbox", { name: "表示名" }), "テストワーカー");
    expect(screen.getByRole("button", { name: "追加" })).toBeEnabled();
  });

  it("送信すると createWorker API が呼ばれる", async () => {
    const createMutateAsync = vi.fn().mockResolvedValue({ id: "new-id", displayName: "テストワーカー" });
    const setMutateAsync = vi.fn().mockResolvedValue({ communityIds: [] });
    stubAll({ createMutateAsync, setMutateAsync });

    renderWithClient(<AddWorkerScene />);
    await userEvent.type(screen.getByRole("textbox", { name: "表示名" }), "テストワーカー");
    await userEvent.click(screen.getByRole("button", { name: "追加" }));

    await waitFor(() =>
      expect(createMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: "テストワーカー" }),
      ),
    );
  });

  it("送信成功後に編集ページへ遷移する", async () => {
    const createMutateAsync = vi.fn().mockResolvedValue({ id: "new-id", displayName: "テストワーカー" });
    const setMutateAsync = vi.fn().mockResolvedValue({ communityIds: [] });
    stubAll({ createMutateAsync, setMutateAsync });

    renderWithClient(<AddWorkerScene />);
    await userEvent.type(screen.getByRole("textbox", { name: "表示名" }), "テストワーカー");
    await userEvent.click(screen.getByRole("button", { name: "追加" }));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: "/admin/workers/$workerId/edit" }),
      ),
    );
  });

  it("「一覧に戻る」リンクが表示される", () => {
    stubAll();
    renderWithClient(<AddWorkerScene />);
    const link = screen.getByRole("link", { name: /一覧に戻る/ });
    expect(link).toBeInTheDocument();
  });

  it("表示名フィールドに WORKER_DISPLAY_NAME_MAX_LENGTH の maxLength が設定されている", () => {
    stubAll();
    renderWithClient(<AddWorkerScene />);
    const input = screen.getByRole("textbox", { name: "表示名" });
    expect(input).toHaveAttribute("maxlength");
  });
});
