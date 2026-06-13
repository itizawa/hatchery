import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Worker } from "@hatchery/common";
import { WORKER_DISPLAY_NAME_MAX_LENGTH, WORKER_ROLE_MAX_LENGTH } from "@hatchery/common";

// useUpdateWorker のモック
vi.mock("../api/workers.js", () => ({
  useUpdateWorker: vi.fn(),
  BOT_WORKERS_QUERY_KEY: ["workers", "bots"],
}));

// 参加コミュニティ編集（#490）関連フックのモック
vi.mock("../api/workerCommunities.js", () => ({
  useWorkerCommunities: vi.fn(),
  useSetWorkerCommunities: vi.fn(),
}));

vi.mock("../api/communities.js", () => ({
  useCommunities: vi.fn(),
}));

import { useUpdateWorker } from "../api/workers.js";
import {
  useSetWorkerCommunities,
  useWorkerCommunities,
} from "../api/workerCommunities.js";
import { useCommunities } from "../api/communities.js";

import { EditWorkerDialog } from "./EditWorkerDialog.js";

const mockWorker: Worker = {
  id: "haru",
  displayName: "ハル",
  role: "ムードメーカー",
  personality: "明るく元気",
};

const mockCommunities = [
  { id: "c1", slug: "tech", name: "テック", description: "d", created_at: new Date() },
  { id: "c2", slug: "life", name: "ライフ", description: "d", created_at: new Date() },
];

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

/** 共通: 全フックをデフォルト値でスタブする。個別テストで override する。 */
function stubAll(opts?: {
  updateMutateAsync?: ReturnType<typeof vi.fn>;
  setMutateAsync?: ReturnType<typeof vi.fn>;
  current?: string[];
}) {
  vi.mocked(useUpdateWorker).mockReturnValue({
    mutateAsync: opts?.updateMutateAsync ?? vi.fn().mockResolvedValue(undefined),
    isPending: false,
    isError: false,
    error: null,
    reset: vi.fn(),
  } as unknown as ReturnType<typeof useUpdateWorker>);
  vi.mocked(useCommunities).mockReturnValue({
    data: mockCommunities,
    isLoading: false,
  } as ReturnType<typeof useCommunities>);
  vi.mocked(useWorkerCommunities).mockReturnValue({
    data: opts?.current ?? [],
    isLoading: false,
    isSuccess: true,
    isError: false,
  } as ReturnType<typeof useWorkerCommunities>);
  vi.mocked(useSetWorkerCommunities).mockReturnValue({
    mutateAsync: opts?.setMutateAsync ?? vi.fn().mockResolvedValue([]),
    isPending: false,
    isError: false,
    error: null,
    reset: vi.fn(),
  } as unknown as ReturnType<typeof useSetWorkerCommunities>);
}

describe("EditWorkerDialog（#181 / #329 / #490）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubAll();
  });

  it("開くとワーカーの現在値がフォームに表示される", () => {
    renderWithClient(<EditWorkerDialog worker={mockWorker} open onClose={vi.fn()} />);

    expect(screen.getByDisplayValue("ハル")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ムードメーカー")).toBeInTheDocument();
    expect(screen.getByDisplayValue("明るく元気")).toBeInTheDocument();
  });

  it("displayName の入力に maxLength=50 が設定されている", () => {
    renderWithClient(<EditWorkerDialog worker={mockWorker} open onClose={vi.fn()} />);

    const displayNameInput = screen.getByLabelText(/表示名/);
    expect(displayNameInput).toHaveAttribute("maxlength", String(WORKER_DISPLAY_NAME_MAX_LENGTH));
  });

  it("role の入力に maxLength=50 が設定されている", () => {
    renderWithClient(<EditWorkerDialog worker={mockWorker} open onClose={vi.fn()} />);

    const roleInput = screen.getByLabelText(/役割/);
    expect(roleInput).toHaveAttribute("maxlength", String(WORKER_ROLE_MAX_LENGTH));
  });

  it("personality の入力に maxLength=500 が設定されている", () => {
    renderWithClient(<EditWorkerDialog worker={mockWorker} open onClose={vi.fn()} />);

    const personalityInput = screen.getByLabelText(/性格/);
    expect(personalityInput).toHaveAttribute("maxlength", "500");
  });

  it("参加コミュニティの複数選択 UI が表示される（#490）", () => {
    renderWithClient(<EditWorkerDialog worker={mockWorker} open onClose={vi.fn()} />);

    expect(screen.getByLabelText(/参加コミュニティ/)).toBeInTheDocument();
  });

  it("保存ボタンを押すと worker 更新と参加コミュニティ置換の両方が呼ばれる（#490）", async () => {
    const updateMutateAsync = vi.fn().mockResolvedValue(undefined);
    const setMutateAsync = vi.fn().mockResolvedValue(["c1"]);
    stubAll({ updateMutateAsync, setMutateAsync, current: ["c1"] });

    renderWithClient(<EditWorkerDialog worker={mockWorker} open onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /保存/ }));

    await waitFor(() => {
      expect(updateMutateAsync).toHaveBeenCalledWith({
        id: "haru",
        body: {
          displayName: "ハル",
          role: "ムードメーカー",
          personality: "明るく元気",
        },
      });
    });
    await waitFor(() => {
      expect(setMutateAsync).toHaveBeenCalledWith({
        workerId: "haru",
        communityIds: ["c1"],
      });
    });
  });

  it("コミュニティを選択して保存すると選択 id で置換される（#490）", async () => {
    const setMutateAsync = vi.fn().mockResolvedValue(["c1"]);
    stubAll({ setMutateAsync, current: [] });

    renderWithClient(<EditWorkerDialog worker={mockWorker} open onClose={vi.fn()} />);

    // MUI Select を開き、テック（c1）を選択する
    fireEvent.mouseDown(screen.getByRole("combobox", { name: /参加コミュニティ/ }));
    fireEvent.click(screen.getByRole("option", { name: /テック/ }));
    // メニューを閉じる
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });

    fireEvent.click(screen.getByRole("button", { name: /保存/ }));

    await waitFor(() => {
      expect(setMutateAsync).toHaveBeenCalledWith({ workerId: "haru", communityIds: ["c1"] });
    });
  });

  it("保存成功後に onClose が呼ばれる", async () => {
    const onClose = vi.fn();
    stubAll();

    renderWithClient(<EditWorkerDialog worker={mockWorker} open onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /保存/ }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("保存失敗時にサーバから返るエラーメッセージが表示される（#476）", async () => {
    const updateMutateAsync = vi.fn().mockRejectedValue(new Error("Forbidden: 権限がありません"));
    stubAll({ updateMutateAsync });
    // update mutation がエラー状態であることをモックで表現する（二重 state を持たず mutation 状態に従う）
    vi.mocked(useUpdateWorker).mockReturnValue({
      mutateAsync: updateMutateAsync,
      isPending: false,
      isError: true,
      error: new Error("Forbidden: 権限がありません"),
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useUpdateWorker>);

    renderWithClient(<EditWorkerDialog worker={mockWorker} open onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /保存/ }));

    // 汎用文言ではなくサーバが返した具体的なメッセージを表示する
    await waitFor(() => {
      expect(screen.getByText(/Forbidden: 権限がありません/)).toBeInTheDocument();
    });
  });

  it("mutation が isError=false のときはエラーが表示されない（二重 state を廃し mutation 状態に従う・#476）", () => {
    // 全 mutation が成功状態。ローカル state に残るエラーは無く、何も表示されない。
    stubAll();
    renderWithClient(<EditWorkerDialog worker={mockWorker} open onClose={vi.fn()} />);

    expect(screen.queryByText(/失敗/)).not.toBeInTheDocument();
  });

  it("参加コミュニティ取得が失敗しても名前・役割は編集・保存でき、置換 API は呼ばれない（#490）", async () => {
    const updateMutateAsync = vi.fn().mockResolvedValue(undefined);
    const setMutateAsync = vi.fn().mockResolvedValue([]);
    const onClose = vi.fn();
    stubAll({ updateMutateAsync, setMutateAsync });
    // 取得失敗状態（isLoading=false / isSuccess=false / isError=true / data=undefined）
    vi.mocked(useWorkerCommunities).mockReturnValue({
      data: undefined,
      isLoading: false,
      isSuccess: false,
      isError: true,
    } as ReturnType<typeof useWorkerCommunities>);

    renderWithClient(<EditWorkerDialog worker={mockWorker} open onClose={onClose} />);

    // ローディングのまま固まらず、保存ボタンが押せる
    const saveButton = screen.getByRole("button", { name: /保存/ });
    expect(saveButton).toBeEnabled();
    fireEvent.click(saveButton);

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    // 取得失敗時は既存紐づきを誤って消さないよう置換 API を呼ばない
    expect(setMutateAsync).not.toHaveBeenCalled();
  });
});
