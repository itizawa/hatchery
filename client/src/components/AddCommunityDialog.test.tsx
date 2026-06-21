/**
 * AddCommunityDialog（コミュニティ作成モーダル）の RTL テスト（#833）。
 * MSW でコミュニティ作成 API をモックし、
 * - ダイアログの開閉
 * - 必須・形式バリデーション（送信ブロック）
 * - 有効入力での作成 API body と onClose
 * - 409 重複エラー表示
 * - inputProps.maxLength が common の Zod .max() 定数と整合すること（#91）
 * を検証する。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import type { ReactElement } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  COMMUNITY_DESCRIPTION_MAX_LENGTH,
  COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH,
  COMMUNITY_NAME_MAX_LENGTH,
  COMMUNITY_SLUG_MAX_LENGTH,
} from "@hatchery/common";

import { AddCommunityDialog } from "./AddCommunityDialog";

let createRequests: unknown[] = [];
let createStatus = 201;

const server = setupServer(
  http.post("/api/admin/communities", async ({ request }) => {
    const body = await request.json();
    createRequests.push(body);
    if (createStatus !== 201) {
      // 実サーバ契約: ConflictError("CommunitySlugAlreadyExists") → { error: "..." } を 409 で返す
      // （server/src/routes/admin.ts / errorHandler.ts）。テストもこの body 形に揃える。
      return HttpResponse.json({ error: "CommunitySlugAlreadyExists" }, { status: createStatus });
    }
    const input = body as { slug: string; name: string; description: string };
    return HttpResponse.json(
      { id: "community-new", ...input, created_at: "2026-06-11T00:00:00.000Z", post_count: 0, last_post_at: null },
      { status: 201 },
    );
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  createRequests = [];
  createStatus = 201;
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function getInputs() {
  return {
    slug: screen.getByRole("textbox", { name: /slug（URL 識別子）/ }),
    name: screen.getByRole("textbox", { name: /コミュニティ名/ }),
    description: screen.getByRole("textbox", { name: /コミュニティ概要（公開）/ }),
    generationInstruction: screen.getByRole("textbox", { name: /生成プロンプト指示/ }),
  };
}

describe("AddCommunityDialog（#833）", () => {
  it("open=true のときダイアログとタイトル「コミュニティを追加」が表示される", () => {
    renderWithClient(<AddCommunityDialog open onClose={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("コミュニティを追加")).toBeInTheDocument();
  });

  it("open=false のときダイアログは表示されない", () => {
    renderWithClient(<AddCommunityDialog open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("slug・名前・概要・生成プロンプト指示の入力欄が表示される", () => {
    renderWithClient(<AddCommunityDialog open onClose={vi.fn()} />);
    const inputs = getInputs();
    expect(inputs.slug).toBeInTheDocument();
    expect(inputs.name).toBeInTheDocument();
    expect(inputs.description).toBeInTheDocument();
    expect(inputs.generationInstruction).toBeInTheDocument();
  });

  it("必須項目が空のまま送信するとエラーが表示され、作成 API は呼ばれない", async () => {
    renderWithClient(<AddCommunityDialog open onClose={vi.fn()} />);
    const inputs = getInputs();
    fireEvent.submit(inputs.slug.closest("form")!);
    expect(await screen.findByText("slug は必須です")).toBeInTheDocument();
    expect(screen.getByText("コミュニティ名は必須です")).toBeInTheDocument();
    expect(screen.getByText("作風の説明は必須です")).toBeInTheDocument();
    expect(createRequests).toHaveLength(0);
  });

  it("slug の形式が不正なとき形式エラーが表示され、作成 API は呼ばれない", async () => {
    renderWithClient(<AddCommunityDialog open onClose={vi.fn()} />);
    const inputs = getInputs();
    await userEvent.type(inputs.slug, "Invalid_Slug");
    await userEvent.type(inputs.name, "テストコミュニティ");
    await userEvent.type(inputs.description, "テスト用の作風説明");
    await userEvent.click(screen.getByRole("button", { name: "作成" }));
    expect(
      await screen.findByText("slug は小文字英数字とハイフンのみ（先頭末尾は英数字）"),
    ).toBeInTheDocument();
    expect(createRequests).toHaveLength(0);
  });

  it("有効な入力で送信すると作成 API が正しい body で呼ばれ onClose が呼ばれる", async () => {
    const onClose = vi.fn();
    renderWithClient(<AddCommunityDialog open onClose={onClose} />);
    const inputs = getInputs();
    await userEvent.type(inputs.slug, "tech-news");
    await userEvent.type(inputs.name, "テックニュース");
    await userEvent.type(inputs.description, "最新技術の話題を語る community");
    await userEvent.type(inputs.generationInstruction, "率直に話す。");
    await userEvent.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => expect(createRequests).toHaveLength(1));
    expect(createRequests[0]).toMatchObject({
      slug: "tech-news",
      name: "テックニュース",
      description: "最新技術の話題を語る community",
      generationInstruction: "率直に話す。",
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("作成 API が 409 を返すと slug 重複エラーメッセージが表示される", async () => {
    createStatus = 409;
    const onClose = vi.fn();
    renderWithClient(<AddCommunityDialog open onClose={onClose} />);
    const inputs = getInputs();
    await userEvent.type(inputs.slug, "ai-dev");
    await userEvent.type(inputs.name, "重複コミュニティ");
    await userEvent.type(inputs.description, "重複する slug のテスト");
    await userEvent.click(screen.getByRole("button", { name: "作成" }));
    expect(await screen.findByText("この slug はすでに使用されています")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("作成送信中はキャンセルボタンが無効になり onClose は呼ばれない", async () => {
    // POST を解決させず保留状態にし、isPending を維持する。
    server.use(http.post("/api/admin/communities", () => new Promise<never>(() => {})));
    const onClose = vi.fn();
    renderWithClient(<AddCommunityDialog open onClose={onClose} />);
    const inputs = getInputs();
    await userEvent.type(inputs.slug, "tech-news");
    await userEvent.type(inputs.name, "テックニュース");
    await userEvent.type(inputs.description, "最新技術の話題を語る community");
    await userEvent.click(screen.getByRole("button", { name: "作成" }));

    // 送信中はキャンセルが無効化され、クリックで閉じられない（onClose/onCreated の二重発火を防ぐ）。
    const cancelButton = screen.getByRole("button", { name: "キャンセル" });
    await waitFor(() => expect(cancelButton).toBeDisabled());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("キャンセルボタンで onClose が呼ばれる", async () => {
    const onClose = vi.fn();
    renderWithClient(<AddCommunityDialog open onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("各入力に Zod .max() と整合する maxLength が設定されている（#91）", () => {
    renderWithClient(<AddCommunityDialog open onClose={vi.fn()} />);
    const inputs = getInputs();
    expect(inputs.slug).toHaveAttribute("maxlength", String(COMMUNITY_SLUG_MAX_LENGTH));
    expect(inputs.name).toHaveAttribute("maxlength", String(COMMUNITY_NAME_MAX_LENGTH));
    expect(inputs.description).toHaveAttribute("maxlength", String(COMMUNITY_DESCRIPTION_MAX_LENGTH));
    expect(inputs.generationInstruction).toHaveAttribute(
      "maxlength",
      String(COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH),
    );
  });
});
