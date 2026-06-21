/**
 * EditCommunityDialog（コミュニティ編集モーダル）の RTL テスト（#833）。
 * MSW でコミュニティ更新 API をモックし、
 * - ダイアログの開閉と既存値の初期表示
 * - 必須バリデーション（送信ブロック）
 * - 保存での更新 API body と onClose
 * - 画像アップロード UI（CommunityImageUpload）の存在
 * - 保存失敗時のエラー表示とダイアログ非クローズ
 * - inputProps.maxLength が common の Zod .max() 定数と整合すること（#91）
 * を検証する。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import type { ReactElement } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminCommunity } from "@hatchery/common";
import {
  COMMUNITY_DESCRIPTION_MAX_LENGTH,
  COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH,
  COMMUNITY_NAME_MAX_LENGTH,
} from "@hatchery/common";

import { EditCommunityDialog } from "./EditCommunityDialog";

const community: AdminCommunity = {
  id: "community-1",
  slug: "ai-dev",
  name: "AI 開発者の集い",
  description: "AI ワーカーが日常を語る community",
  generationInstruction: "率直に話す。",
  iconUrl: null,
  coverUrl: null,
  created_at: new Date("2026-06-01T00:00:00.000Z"),
  post_count: 3,
  last_post_at: "2026-06-10T09:00:00.000Z",
};

let updateRequests: { id: string; body: unknown }[] = [];
let updateStatus = 200;

const server = setupServer(
  http.patch("/api/admin/communities/:id", async ({ request, params }) => {
    const body = await request.json();
    updateRequests.push({ id: String(params.id), body });
    if (updateStatus !== 200) {
      return HttpResponse.json({ error: "更新に失敗しました" }, { status: updateStatus });
    }
    const input = body as { name?: string; description?: string };
    return HttpResponse.json({
      id: community.id,
      slug: community.slug,
      name: community.name,
      description: community.description,
      created_at: "2026-06-01T00:00:00.000Z",
      post_count: 3,
      last_post_at: "2026-06-10T09:00:00.000Z",
      ...input,
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  updateRequests = [];
  updateStatus = 200;
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("EditCommunityDialog（#833）", () => {
  it("open=true のときダイアログとタイトル「コミュニティ編集」が表示される", () => {
    renderWithClient(<EditCommunityDialog community={community} open onClose={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("コミュニティ編集")).toBeInTheDocument();
  });

  it("open=false のときダイアログは表示されない", () => {
    renderWithClient(<EditCommunityDialog community={community} open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("既存値（name・description・generationInstruction）が初期表示される", () => {
    renderWithClient(<EditCommunityDialog community={community} open onClose={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: /コミュニティ名/ })).toHaveValue("AI 開発者の集い");
    expect(screen.getByRole("textbox", { name: /コミュニティ概要（公開）/ })).toHaveValue(
      "AI ワーカーが日常を語る community",
    );
    expect(screen.getByRole("textbox", { name: /生成プロンプト指示/ })).toHaveValue("率直に話す。");
  });

  it("name を変更して保存すると更新 API が変更後の body で呼ばれ onClose が呼ばれる", async () => {
    const onClose = vi.fn();
    renderWithClient(<EditCommunityDialog community={community} open onClose={onClose} />);
    const nameInput = screen.getByRole("textbox", { name: /コミュニティ名/ });
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "AI 開発者の広場");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(updateRequests).toHaveLength(1));
    expect(updateRequests[0]).toMatchObject({
      id: "community-1",
      body: {
        name: "AI 開発者の広場",
        description: "AI ワーカーが日常を語る community",
      },
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("name を空にして送信するとエラーが表示され、更新 API は呼ばれない", async () => {
    renderWithClient(<EditCommunityDialog community={community} open onClose={vi.fn()} />);
    const nameInput = screen.getByRole("textbox", { name: /コミュニティ名/ });
    await userEvent.clear(nameInput);
    fireEvent.submit(nameInput.closest("form")!);
    expect(await screen.findByText("コミュニティ名は必須です")).toBeInTheDocument();
    expect(updateRequests).toHaveLength(0);
  });

  it("カバー・アイコン画像のアップロード UI が表示される（#457）", () => {
    renderWithClient(<EditCommunityDialog community={community} open onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("カバー画像（ヘッダー）")).toBeInTheDocument();
    expect(within(dialog).getByText("アイコン画像（クリックして変更）")).toBeInTheDocument();
  });

  it("更新 API が失敗するとエラーが表示され、ダイアログは閉じない", async () => {
    updateStatus = 500;
    const onClose = vi.fn();
    renderWithClient(<EditCommunityDialog community={community} open onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    // サーバが返したエラー文言が Snackbar に表示される（getApiErrorMessage 経由）。
    expect(await screen.findByText("更新に失敗しました")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("各入力に Zod .max() と整合する maxLength が設定されている（#91）", () => {
    renderWithClient(<EditCommunityDialog community={community} open onClose={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: /コミュニティ名/ })).toHaveAttribute(
      "maxlength",
      String(COMMUNITY_NAME_MAX_LENGTH),
    );
    expect(screen.getByRole("textbox", { name: /コミュニティ概要（公開）/ })).toHaveAttribute(
      "maxlength",
      String(COMMUNITY_DESCRIPTION_MAX_LENGTH),
    );
    expect(screen.getByRole("textbox", { name: /生成プロンプト指示/ })).toHaveAttribute(
      "maxlength",
      String(COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH),
    );
  });
});
