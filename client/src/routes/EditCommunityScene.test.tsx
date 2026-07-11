/**
 * EditCommunityScene のレンダリングテスト（#889）。
 * コミュニティ編集ページ（/admin/communities/:communityId/edit）のフォーム表示と送信動作を検証する。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type React from "react";

import type { AdminCommunity } from "@hatchery/common";

const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useParams: () => ({ communityId: "community-abc" }),
    useNavigate: () => mockNavigate,
    Link: ({ children, to, search }: { children: React.ReactNode; to: string; search?: unknown }) => (
      <a href={search ? `${to}?${new URLSearchParams(search as Record<string, string>).toString()}` : to}>{children}</a>
    ),
  };
});

vi.mock("../api/communities.js", () => ({
  useCommunities: vi.fn(),
  useUpdateCommunity: vi.fn(),
}));

vi.mock("../api/communityWorkers.js", () => ({
  useCommunityWorkerAssignments: vi.fn(),
  useSetCommunityWorkerAssignments: vi.fn(),
}));

vi.mock("../api/workers.js", () => ({
  useBotWorkers: vi.fn(),
}));

vi.mock("../components/CommunityImageUpload.js", () => ({
  CommunityImageUpload: ({ name, kind }: { name: string; kind: string }) => (
    <div data-testid={`community-image-upload-${kind}`}>CommunityImageUpload: {name}</div>
  ),
}));

import { useCommunities, useUpdateCommunity } from "../api/communities.js";
import { useCommunityWorkerAssignments, useSetCommunityWorkerAssignments } from "../api/communityWorkers.js";
import { useBotWorkers } from "../api/workers.js";
import { EditCommunityScene } from "./EditCommunityScene.js";

const mockCommunity: AdminCommunity = {
  id: "community-abc",
  slug: "ai-dev",
  name: "AI 開発者の集い",
  description: "AI について語る community",
  generationInstruction: "率直に話す",
  feedUrl: "https://zenn.dev/feed",
  iconUrl: null,
  coverUrl: null,
  created_at: new Date("2026-06-01T00:00:00.000Z"),
  post_count: 3,
  last_post_at: null,
  generationPaused: false,
};

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function stubAll(opts?: {
  communities?: AdminCommunity[];
  updateMutateAsync?: ReturnType<typeof vi.fn>;
  communityWorkers?: { id: string; displayName: string }[];
  setWorkersMutateAsync?: ReturnType<typeof vi.fn>;
  botWorkers?: { id: string; displayName: string }[];
}) {
  vi.mocked(useCommunities).mockReturnValue({
    data: opts?.communities ?? [mockCommunity],
  } as ReturnType<typeof useCommunities>);

  vi.mocked(useUpdateCommunity).mockReturnValue({
    mutateAsync: opts?.updateMutateAsync ?? vi.fn().mockResolvedValue(mockCommunity),
    isPending: false,
    isError: false,
    error: null,
    reset: vi.fn(),
  } as unknown as ReturnType<typeof useUpdateCommunity>);

  vi.mocked(useCommunityWorkerAssignments).mockReturnValue({
    data: opts?.communityWorkers ?? [],
    isLoading: false,
    isSuccess: true,
    isError: false,
  } as ReturnType<typeof useCommunityWorkerAssignments>);

  vi.mocked(useSetCommunityWorkerAssignments).mockReturnValue({
    mutateAsync: opts?.setWorkersMutateAsync ?? vi.fn().mockResolvedValue([]),
    isPending: false,
    isError: false,
    error: null,
    reset: vi.fn(),
  } as unknown as ReturnType<typeof useSetCommunityWorkerAssignments>);

  vi.mocked(useBotWorkers).mockReturnValue({
    data: opts?.botWorkers ?? [{ id: "w1", displayName: "haru" }],
  } as ReturnType<typeof useBotWorkers>);
}

describe("EditCommunityScene（#889）", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it("ページタイトル「コミュニティを編集」が表示される", () => {
    stubAll();
    renderWithClient(<EditCommunityScene />);
    expect(screen.getByRole("heading", { name: "コミュニティを編集" })).toBeInTheDocument();
  });

  it("コミュニティ名がフォームに反映される", () => {
    stubAll();
    renderWithClient(<EditCommunityScene />);
    expect(screen.getByDisplayValue("AI 開発者の集い")).toBeInTheDocument();
  });

  it("コミュニティ概要がフォームに反映される", () => {
    stubAll();
    renderWithClient(<EditCommunityScene />);
    expect(screen.getByDisplayValue("AI について語る community")).toBeInTheDocument();
  });

  it("生成プロンプト指示がフォームに反映される", () => {
    stubAll();
    renderWithClient(<EditCommunityScene />);
    expect(screen.getByDisplayValue("率直に話す")).toBeInTheDocument();
  });

  it("外部フィード URL がフォームに反映される（#1104）", () => {
    stubAll();
    renderWithClient(<EditCommunityScene />);
    expect(screen.getByDisplayValue("https://zenn.dev/feed")).toBeInTheDocument();
  });

  it("slug が読み取り専用で表示される（入力欄ではない）", () => {
    stubAll();
    renderWithClient(<EditCommunityScene />);
    expect(screen.getByText("ai-dev")).toBeInTheDocument();
    // slug は読み取り専用なので input として操作できない
    expect(screen.queryByRole("textbox", { name: /slug/ })).not.toBeInTheDocument();
  });

  it("CommunityImageUpload（cover）が表示される", () => {
    stubAll();
    renderWithClient(<EditCommunityScene />);
    expect(screen.getByTestId("community-image-upload-cover")).toBeInTheDocument();
  });

  it("CommunityImageUpload（icon）が表示される", () => {
    stubAll();
    renderWithClient(<EditCommunityScene />);
    expect(screen.getByTestId("community-image-upload-icon")).toBeInTheDocument();
  });

  it("保存ボタンを押すと updateCommunity API が呼ばれる", async () => {
    const updateMutateAsync = vi.fn().mockResolvedValue(mockCommunity);
    stubAll({ updateMutateAsync });
    renderWithClient(<EditCommunityScene />);
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled());
  });

  it("「一覧に戻る」リンクが表示される", () => {
    stubAll();
    renderWithClient(<EditCommunityScene />);
    expect(screen.getByRole("link", { name: /一覧に戻る/ })).toBeInTheDocument();
  });

  it("保存に成功すると一覧画面（/admin?tab=communities&communitySaved=1）へ遷移する（#1081）", async () => {
    const updateMutateAsync = vi.fn().mockResolvedValue(mockCommunity);
    stubAll({ updateMutateAsync });
    renderWithClient(<EditCommunityScene />);
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/admin",
        search: { tab: "communities", communitySaved: 1 },
      }),
    );
  });

  it("保存に失敗した場合は画面遷移しない（#1081）", async () => {
    const updateMutateAsync = vi.fn().mockRejectedValue(new Error("update failed"));
    stubAll({ updateMutateAsync });
    renderWithClient(<EditCommunityScene />);
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled());
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("存在しない ID のとき「コミュニティが見つかりません」が表示される", () => {
    stubAll({ communities: [] });
    renderWithClient(<EditCommunityScene />);
    expect(screen.getByText("コミュニティが見つかりません")).toBeInTheDocument();
  });

  it("存在しない ID のとき一覧へ戻るリンクが表示される", () => {
    stubAll({ communities: [] });
    renderWithClient(<EditCommunityScene />);
    expect(screen.getByRole("link", { name: /コミュニティ一覧へ戻る/ })).toBeInTheDocument();
  });

  it("所属ワーカーの選択 UI が表示される（#1079）", () => {
    stubAll();
    renderWithClient(<EditCommunityScene />);
    expect(screen.getByLabelText(/所属ワーカー/)).toBeInTheDocument();
  });

  it("現在の所属ワーカーが選択 UI に反映される（#1079）", () => {
    stubAll({
      communityWorkers: [{ id: "w1", displayName: "haru" }],
      botWorkers: [
        { id: "w1", displayName: "haru" },
        { id: "w2", displayName: "ken" },
      ],
    });
    renderWithClient(<EditCommunityScene />);
    const combobox = screen.getByRole("combobox", { name: /所属ワーカー/ });
    expect(within(combobox).getByText("haru")).toBeInTheDocument();
    expect(within(combobox).queryByText("ken")).not.toBeInTheDocument();
  });

  it("所属ワーカーの保存ボタンを押すと所属ワーカー更新 API が呼ばれる（#1079）", async () => {
    const setWorkersMutateAsync = vi.fn().mockResolvedValue([]);
    stubAll({ setWorkersMutateAsync });
    renderWithClient(<EditCommunityScene />);
    await userEvent.click(screen.getByRole("button", { name: /所属ワーカーを保存/ }));
    await waitFor(() => expect(setWorkersMutateAsync).toHaveBeenCalled());
  });

  it("コミュニティ本体の保存ボタンを押しても所属ワーカー更新 API は呼ばれない（独立した保存単位・#1079）", async () => {
    const updateMutateAsync = vi.fn().mockResolvedValue(mockCommunity);
    const setWorkersMutateAsync = vi.fn().mockResolvedValue([]);
    stubAll({ updateMutateAsync, setWorkersMutateAsync });
    renderWithClient(<EditCommunityScene />);
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled());
    expect(setWorkersMutateAsync).not.toHaveBeenCalled();
  });

  it("所属ワーカー取得後にバックグラウンド再取得が発生しても編集中の選択が上書きされない（#1079）", () => {
    stubAll({
      communityWorkers: [{ id: "w1", displayName: "haru" }],
      botWorkers: [
        { id: "w1", displayName: "haru" },
        { id: "w2", displayName: "ken" },
      ],
    });
    const { rerender } = renderWithClient(<EditCommunityScene />);

    // ユーザーが「ken」を追加選択する（保存前の未確定な編集状態）。
    const combobox = screen.getByRole("combobox", { name: /所属ワーカー/ });
    fireEvent.mouseDown(combobox);
    const listbox = screen.getByRole("listbox");
    fireEvent.click(within(listbox).getByRole("option", { name: /ken/ }));
    fireEvent.keyDown(listbox, { key: "Escape" });

    // ウィンドウフォーカス復帰等でクエリがバックグラウンド再取得され、
    // サーバ側の古い値（新しい配列参照）で data が更新されたことをシミュレートする。
    vi.mocked(useCommunityWorkerAssignments).mockReturnValue({
      data: [{ id: "w1", displayName: "haru" }],
      isLoading: false,
      isSuccess: true,
      isError: false,
    } as ReturnType<typeof useCommunityWorkerAssignments>);
    rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <EditCommunityScene />
      </QueryClientProvider>,
    );

    // 再取得後も、ユーザーが追加選択した「ken」が選択状態のまま残る（上書きされない）。
    const comboboxAfter = screen.getByRole("combobox", { name: /所属ワーカー/ });
    expect(within(comboboxAfter).getByText("ken")).toBeInTheDocument();
  });
});
