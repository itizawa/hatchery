/**
 * EditWorkerScene のレンダリングテスト（#888）。
 * ワーカー編集ページ（/admin/workers/:workerId/edit）のフォーム表示と送信動作を検証する。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type React from "react";

import type { Worker } from "@hatchery/common";

// useParams / useNavigate / Link をモックする
const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useParams: () => ({ workerId: "worker-abc" }),
    useNavigate: () => mockNavigate,
    Link: ({ children, to, search }: { children: React.ReactNode; to: string; search?: unknown }) => (
      <a href={search ? `${to}?${new URLSearchParams(search as Record<string, string>).toString()}` : to}>{children}</a>
    ),
  };
});

vi.mock("../api/workers.js", () => ({
  useWorkerDetail: vi.fn(),
  useUpdateWorker: vi.fn(),
  BOT_WORKERS_QUERY_KEY: ["workers", "bots"],
}));

vi.mock("../api/workerCommunities.js", () => ({
  useWorkerCommunities: vi.fn(),
  useSetWorkerCommunities: vi.fn(),
}));

vi.mock("../api/communities.js", () => ({
  useCommunities: vi.fn(),
}));

vi.mock("../components/WorkerImageUpload.js", () => ({
  WorkerImageUpload: ({ displayName }: { displayName: string }) => (
    <div data-testid="worker-image-upload">WorkerImageUpload: {displayName}</div>
  ),
}));

import { useWorkerDetail, useUpdateWorker } from "../api/workers.js";
import { useWorkerCommunities, useSetWorkerCommunities } from "../api/workerCommunities.js";
import { useCommunities } from "../api/communities.js";
import { EditWorkerScene } from "./EditWorkerScene.js";

const mockWorker: Worker = {
  id: "worker-abc",
  displayName: "テストワーカー",
  role: "エンジニア",
  personality: "論理的",
  verbosity: "standard",
};

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function stubAll(opts?: {
  workerData?: Worker;
  updateMutateAsync?: ReturnType<typeof vi.fn>;
  setMutateAsync?: ReturnType<typeof vi.fn>;
  workerCommunities?: string[];
}) {
  vi.mocked(useWorkerDetail).mockReturnValue({
    data: opts?.workerData ?? mockWorker,
  } as ReturnType<typeof useWorkerDetail>);

  vi.mocked(useUpdateWorker).mockReturnValue({
    mutateAsync: opts?.updateMutateAsync ?? vi.fn().mockResolvedValue(undefined),
    isPending: false,
    isError: false,
    error: null,
    reset: vi.fn(),
  } as unknown as ReturnType<typeof useUpdateWorker>);

  vi.mocked(useWorkerCommunities).mockReturnValue({
    data: opts?.workerCommunities ?? [],
    isLoading: false,
    isSuccess: true,
    isError: false,
  } as ReturnType<typeof useWorkerCommunities>);

  vi.mocked(useSetWorkerCommunities).mockReturnValue({
    mutateAsync: opts?.setMutateAsync ?? vi.fn().mockResolvedValue({ communityIds: [] }),
    isPending: false,
    isError: false,
    error: null,
    reset: vi.fn(),
  } as unknown as ReturnType<typeof useSetWorkerCommunities>);

  vi.mocked(useCommunities).mockReturnValue({
    data: [],
    isLoading: false,
  } as ReturnType<typeof useCommunities>);
}

describe("EditWorkerScene（#888）", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it("ページタイトル「ワーカーを編集」が表示される", () => {
    stubAll();
    renderWithClient(<EditWorkerScene />);
    expect(screen.getByRole("heading", { name: "ワーカーを編集" })).toBeInTheDocument();
  });

  it("ワーカーの表示名がフォームに反映される", () => {
    stubAll();
    renderWithClient(<EditWorkerScene />);
    expect(screen.getByDisplayValue("テストワーカー")).toBeInTheDocument();
  });

  it("ワーカーの役割がフォームに反映される", () => {
    stubAll();
    renderWithClient(<EditWorkerScene />);
    expect(screen.getByDisplayValue("エンジニア")).toBeInTheDocument();
  });

  it("ワーカーの性格がフォームに反映される", () => {
    stubAll();
    renderWithClient(<EditWorkerScene />);
    expect(screen.getByDisplayValue("論理的")).toBeInTheDocument();
  });

  it("文章量の選択 UI が表示される", () => {
    stubAll();
    renderWithClient(<EditWorkerScene />);
    expect(screen.getByLabelText(/文章量/)).toBeInTheDocument();
  });

  it("参加コミュニティの選択 UI が表示される", () => {
    stubAll();
    renderWithClient(<EditWorkerScene />);
    expect(screen.getByLabelText(/参加コミュニティ/)).toBeInTheDocument();
  });

  it("WorkerImageUpload が表示される", () => {
    stubAll();
    renderWithClient(<EditWorkerScene />);
    expect(screen.getByTestId("worker-image-upload")).toBeInTheDocument();
  });

  it("保存ボタンを押すと update API が呼ばれる", async () => {
    const updateMutateAsync = vi.fn().mockResolvedValue(undefined);
    stubAll({ updateMutateAsync });
    renderWithClient(<EditWorkerScene />);
    await userEvent.click(screen.getByRole("button", { name: /保存/ }));
    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled());
  });

  it("「一覧に戻る」リンクが表示される", () => {
    stubAll();
    renderWithClient(<EditWorkerScene />);
    const link = screen.getByRole("link", { name: /一覧に戻る/ });
    expect(link).toBeInTheDocument();
  });

  it("表示名フィールドに maxLength が設定されている", () => {
    stubAll();
    renderWithClient(<EditWorkerScene />);
    const input = screen.getByRole("textbox", { name: "表示名" });
    expect(input).toHaveAttribute("maxlength");
  });

  it("保存に成功すると一覧画面（/admin?tab=users&workerSaved=1）へ遷移する（#1080）", async () => {
    const updateMutateAsync = vi.fn().mockResolvedValue(undefined);
    const setMutateAsync = vi.fn().mockResolvedValue({ communityIds: [] });
    stubAll({ updateMutateAsync, setMutateAsync });
    renderWithClient(<EditWorkerScene />);
    await userEvent.click(screen.getByRole("button", { name: /保存/ }));
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/admin",
        search: { tab: "users", workerSaved: 1 },
      }),
    );
  });

  it("保存（update）に失敗した場合は画面遷移しない（#1080）", async () => {
    const updateMutateAsync = vi.fn().mockRejectedValue(new Error("update failed"));
    stubAll({ updateMutateAsync });
    renderWithClient(<EditWorkerScene />);
    await userEvent.click(screen.getByRole("button", { name: /保存/ }));
    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled());
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("参加コミュニティの保存に失敗した場合は画面遷移しない（#1080）", async () => {
    const updateMutateAsync = vi.fn().mockResolvedValue(undefined);
    const setMutateAsync = vi.fn().mockRejectedValue(new Error("set communities failed"));
    stubAll({ updateMutateAsync, setMutateAsync });
    renderWithClient(<EditWorkerScene />);
    await userEvent.click(screen.getByRole("button", { name: /保存/ }));
    await waitFor(() => expect(setMutateAsync).toHaveBeenCalled());
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
