/**
 * CommunitiesTab（管理画面のコミュニティ作成/編集フォーム）の RTL テスト（#381）。
 * MSW（msw/node setupServer）でコミュニティ API をモックし、
 * - 必須バリデーション（空送信で mutation が呼ばれない）
 * - 作成 mutation の body と成功スナックバー
 * - 編集フォームの初期値表示と更新 mutation の body
 * - inputProps.maxLength が common の Zod .max() 定数と整合すること（#91）
 * を検証する。ネットワーク実アクセスはしない（onUnhandledRequest: "error"）。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import type { ReactElement } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  COMMUNITY_DESCRIPTION_MAX_LENGTH,
  COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH,
  COMMUNITY_NAME_MAX_LENGTH,
  COMMUNITY_SLUG_MAX_LENGTH,
} from "@hatchery/common";

import { CommunitiesTab } from "./CommunitiesTab";

// ─── MSW セットアップ ───────────────────────────────────────────────────────

/** 一覧 GET が返す既存コミュニティ（編集テストの前提データ）。 */
const existingCommunity = {
  id: "community-1",
  slug: "ai-dev",
  name: "AI 開発者の集い",
  description: "AI ワーカーが日常を語る community",
  created_at: "2026-06-01T00:00:00.000Z",
};

/** POST /api/admin/communities が受信した body の記録。 */
let createRequests: unknown[] = [];
/** PATCH /api/admin/communities/:id が受信した { id, body } の記録。 */
let updateRequests: { id: string; body: unknown }[] = [];
/** POST に返すステータス（409 テスト用に差し替える）。 */
let createStatus = 201;

const server = setupServer(
  http.get("/api/admin/communities", () => HttpResponse.json([existingCommunity])),
  http.post("/api/admin/communities", async ({ request }) => {
    const body = await request.json();
    createRequests.push(body);
    if (createStatus !== 201) {
      return HttpResponse.json({ message: "conflict" }, { status: createStatus });
    }
    const input = body as { slug: string; name: string; description: string };
    return HttpResponse.json(
      { id: "community-new", ...input, created_at: "2026-06-11T00:00:00.000Z" },
      { status: 201 },
    );
  }),
  http.patch("/api/admin/communities/:id", async ({ request, params }) => {
    const body = await request.json();
    updateRequests.push({ id: String(params.id), body });
    const input = body as { name?: string; description?: string };
    return HttpResponse.json({ ...existingCommunity, ...input });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  createRequests = [];
  updateRequests = [];
  createStatus = 201;
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

/** 作成フォーム（コミュニティ一覧テーブルの外側）の各入力欄を取得する。 */
function getCreateFormInputs() {
  return {
    slug: screen.getByRole("textbox", { name: /slug（URL 識別子）/ }),
    name: screen.getAllByRole("textbox", { name: /コミュニティ名/ })[0],
    description: screen.getAllByRole("textbox", { name: /コミュニティ概要（公開）/ })[0],
  };
}

// ─── テスト本体 ─────────────────────────────────────────────────────────────

describe("CommunitiesTab（#381）", () => {
  it("作成フォームの入力欄とコミュニティ一覧（既存データ）が表示される", async () => {
    renderWithClient(<CommunitiesTab />);
    expect(screen.getByText("新しいコミュニティを作成")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /slug（URL 識別子）/ })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /コミュニティ名/ })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /コミュニティ概要（公開）/ })).toBeInTheDocument();
    // 一覧に既存コミュニティが表示される（GET /api/admin/communities）
    expect(await screen.findByText("AI 開発者の集い")).toBeInTheDocument();
    expect(screen.getByText("ai-dev")).toBeInTheDocument();
  });

  it("必須項目が空のまま送信するとバリデーションエラーが表示され、作成 API は呼ばれない", async () => {
    renderWithClient(<CommunitiesTab />);
    await screen.findByText("AI 開発者の集い");

    // 第一の防御: 各入力に required があり、ネイティブ制約で submit がブロックされる
    const inputs = getCreateFormInputs();
    expect(inputs.slug).toBeRequired();
    expect(inputs.name).toBeRequired();
    expect(inputs.description).toBeRequired();
    await userEvent.click(screen.getByRole("button", { name: "作成" }));
    expect(createRequests).toHaveLength(0);

    // 第二の防御: submit イベントが直接発火しても useForm の onSubmit バリデーションが
    // エラーを表示して mutation を止める（required 制約をバイパスして検証）
    fireEvent.submit(inputs.slug.closest("form")!);
    expect(await screen.findByText("slug は必須です")).toBeInTheDocument();
    expect(screen.getByText("コミュニティ名は必須です")).toBeInTheDocument();
    expect(screen.getByText("作風の説明は必須です")).toBeInTheDocument();
    expect(createRequests).toHaveLength(0);
  });

  it("slug の形式が不正なとき形式エラーが表示され、作成 API は呼ばれない", async () => {
    renderWithClient(<CommunitiesTab />);
    await screen.findByText("AI 開発者の集い");

    const inputs = getCreateFormInputs();
    await userEvent.type(inputs.slug, "Invalid_Slug");
    await userEvent.type(inputs.name, "テストコミュニティ");
    await userEvent.type(inputs.description, "テスト用の作風説明");
    await userEvent.click(screen.getByRole("button", { name: "作成" }));

    expect(
      await screen.findByText("slug は小文字英数字とハイフンのみ（先頭末尾は英数字）"),
    ).toBeInTheDocument();
    expect(createRequests).toHaveLength(0);
  });

  it("有効な入力で送信すると作成 API が正しい body で呼ばれ、成功スナックバーが表示される", async () => {
    renderWithClient(<CommunitiesTab />);
    await screen.findByText("AI 開発者の集い");

    const inputs = getCreateFormInputs();
    await userEvent.type(inputs.slug, "tech-news");
    await userEvent.type(inputs.name, "テックニュース");
    await userEvent.type(inputs.description, "最新技術の話題を語る community");
    await userEvent.click(screen.getByRole("button", { name: "作成" }));

    expect(await screen.findByText("コミュニティを作成しました")).toBeInTheDocument();
    expect(createRequests).toHaveLength(1);
    expect(createRequests[0]).toMatchObject({
      slug: "tech-news",
      name: "テックニュース",
      description: "最新技術の話題を語る community",
    });
    // 成功後にフォームがリセットされる
    expect(inputs.slug).toHaveValue("");
    expect(inputs.name).toHaveValue("");
    expect(inputs.description).toHaveValue("");
  });

  it("作成 API が 409 を返すと slug 重複エラーメッセージが表示される", async () => {
    createStatus = 409;
    renderWithClient(<CommunitiesTab />);
    await screen.findByText("AI 開発者の集い");

    const inputs = getCreateFormInputs();
    await userEvent.type(inputs.slug, "ai-dev");
    await userEvent.type(inputs.name, "重複コミュニティ");
    await userEvent.type(inputs.description, "重複する slug のテスト");
    await userEvent.click(screen.getByRole("button", { name: "作成" }));

    expect(
      await screen.findByText("この slug はすでに使用されています"),
    ).toBeInTheDocument();
  });

  it("編集フォームに既存値が初期表示され、保存で更新 API が正しい body で呼ばれる", async () => {
    renderWithClient(<CommunitiesTab />);
    await screen.findByText("AI 開発者の集い");

    await userEvent.click(screen.getByRole("button", { name: "編集" }));

    // 編集フォームはテーブル行内に表示され、既存値が初期表示される
    const table = screen.getByRole("table");
    const nameInput = within(table).getByRole("textbox", { name: /コミュニティ名/ });
    const descriptionInput = within(table).getByRole("textbox", { name: /コミュニティ概要（公開）/ });
    expect(nameInput).toHaveValue("AI 開発者の集い");
    expect(descriptionInput).toHaveValue("AI ワーカーが日常を語る community");

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
    // 保存成功後は編集モードが閉じて行表示に戻る
    await waitFor(() =>
      expect(
        within(table).queryByRole("textbox", { name: /コミュニティ名/ }),
      ).not.toBeInTheDocument(),
    );
  });

  it("編集フォームで必須項目を空にして保存するとエラーが表示され、更新 API は呼ばれない", async () => {
    renderWithClient(<CommunitiesTab />);
    await screen.findByText("AI 開発者の集い");

    await userEvent.click(screen.getByRole("button", { name: "編集" }));
    const table = screen.getByRole("table");
    const nameInput = within(table).getByRole("textbox", { name: /コミュニティ名/ });
    await userEvent.clear(nameInput);

    // ネイティブ required 制約で submit がブロックされ、更新 API は呼ばれない
    expect(nameInput).toBeRequired();
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(updateRequests).toHaveLength(0);

    // submit イベントが直接発火しても useForm の onSubmit バリデーションが
    // エラーを表示して mutation を止める（required 制約をバイパスして検証）
    fireEvent.submit(nameInput.closest("form")!);
    expect(await within(table).findByText("コミュニティ名は必須です")).toBeInTheDocument();
    expect(updateRequests).toHaveLength(0);
  });

  it("作成フォームの各入力に Zod .max() と整合する maxLength が設定されている（#91）", async () => {
    renderWithClient(<CommunitiesTab />);
    await screen.findByText("AI 開発者の集い");

    const inputs = getCreateFormInputs();
    expect(inputs.slug).toHaveAttribute("maxlength", String(COMMUNITY_SLUG_MAX_LENGTH));
    expect(inputs.name).toHaveAttribute("maxlength", String(COMMUNITY_NAME_MAX_LENGTH));
    expect(inputs.description).toHaveAttribute(
      "maxlength",
      String(COMMUNITY_DESCRIPTION_MAX_LENGTH),
    );
    const genInstrInput = screen.getAllByRole("textbox", { name: /生成プロンプト指示/ })[0];
    expect(genInstrInput).toHaveAttribute(
      "maxlength",
      String(COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH),
    );
  });

  it("編集フォームの各入力に Zod .max() と整合する maxLength が設定されている（#91）", async () => {
    renderWithClient(<CommunitiesTab />);
    await screen.findByText("AI 開発者の集い");

    await userEvent.click(screen.getByRole("button", { name: "編集" }));
    const table = screen.getByRole("table");
    expect(within(table).getByRole("textbox", { name: /コミュニティ名/ })).toHaveAttribute(
      "maxlength",
      String(COMMUNITY_NAME_MAX_LENGTH),
    );
    expect(within(table).getByRole("textbox", { name: /コミュニティ概要（公開）/ })).toHaveAttribute(
      "maxlength",
      String(COMMUNITY_DESCRIPTION_MAX_LENGTH),
    );
    expect(
      within(table).getByRole("textbox", { name: /生成プロンプト指示/ }),
    ).toHaveAttribute("maxlength", String(COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH));
  });
});
