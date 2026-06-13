import * as adminApi from "../api/admin.js";
import { DEFAULT_WORKERS } from "@hatchery/common";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as authApi from "../api/auth.js";
import { createQueryClient } from "../queryClient.js";
import { createAppRouter } from "../router.js";

/**
 * authUser を渡すと QueryClient に事前シードする。
 * vi.spyOn(authApi, "fetchMe") は router.tsx の直接呼び出し（requireAdminRoute）は
 * スパイできるが、useAuth() 内部の queryFn は同モジュール内ローカル参照のため届かない。
 * QueryClient への事前シードで useAuth() の戻り値も制御する。
 */
function renderApp(
  initialPath: string,
  authUser?: { id: string; displayName: string; role: "admin" | "member" } | null,
) {
  const queryClient = createQueryClient();
  if (authUser !== undefined) {
    queryClient.setQueryData(authApi.AUTH_ME_QUERY_KEY, authUser);
  }
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router };
}

describe("管理画面（#50）", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("ログイン済でサイドバーの「管理画面」リンクをクリックすると管理画面が表示される", async () => {
    const adminUser = { id: "user1", displayName: "Alice", role: "admin" as const };
    vi.spyOn(authApi, "fetchMe").mockResolvedValue(adminUser);
    renderApp("/", adminUser);

    const adminLink = await screen.findByRole("link", { name: "管理画面" });
    await userEvent.click(adminLink);

    expect(await screen.findByRole("heading", { name: /管理画面/ })).toBeInTheDocument();
  });

  it("管理画面（/admin）のワーカー管理タブに「社員を追加」ボタンが表示される（#217）", async () => {
    vi.spyOn(authApi, "fetchMe").mockResolvedValue({ id: "user1", displayName: "Alice", role: "admin" });
    vi.spyOn(adminApi, "useAdminWorkers").mockReturnValue({
      data: DEFAULT_WORKERS.map((w) => ({ ...w })),
    } as ReturnType<typeof adminApi.useAdminWorkers>);
    renderApp("/admin");

    expect(await screen.findByRole("tab", { name: /ワーカー管理/ })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "社員を追加" })).toBeInTheDocument();
    });
  });
});

describe("設定画面タブ URL 同期・アクセシビリティ（#67）", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authApi, "fetchMe").mockResolvedValue({ id: "user1", displayName: "Alice", role: "admin" });
  });

  it("?tab=api-token で開くと「API トークン設定」タブがアクティブになる", async () => {
    renderApp("/admin?tab=api-token");

    const apiTokenTab = await screen.findByRole("tab", { name: /API トークン設定/ });
    expect(apiTokenTab).toHaveAttribute("aria-selected", "true");
  });

  it("?tab= 無し（デフォルト）で開くと「ワーカー管理」タブがアクティブになる", async () => {
    renderApp("/admin");

    const usersTab = await screen.findByRole("tab", { name: /ワーカー管理/ });
    expect(usersTab).toHaveAttribute("aria-selected", "true");
  });

  it("?tab=invalid（不正値）で開くと「ワーカー管理」タブにフォールバックする", async () => {
    renderApp("/admin?tab=invalid");

    const usersTab = await screen.findByRole("tab", { name: /ワーカー管理/ });
    expect(usersTab).toHaveAttribute("aria-selected", "true");

    const apiTokenTab = screen.getByRole("tab", { name: /API トークン設定/ });
    expect(apiTokenTab).toHaveAttribute("aria-selected", "false");
  });

  it("各タブに id='settings-tab-{value}' が設定されている", async () => {
    renderApp("/admin");

    expect(await screen.findByRole("tab", { name: /ワーカー管理/ })).toHaveAttribute(
      "id",
      "settings-tab-users",
    );
    expect(screen.getByRole("tab", { name: /API トークン設定/ })).toHaveAttribute(
      "id",
      "settings-tab-api-token",
    );
  });

  it("各タブパネルに id・aria-labelledby が設定されている", async () => {
    renderApp("/admin");

    await screen.findByRole("tab", { name: /ワーカー管理/ });

    const tabpanels = screen.getAllByRole("tabpanel", { hidden: true });
    const usersPanel = tabpanels.find((p) => p.id === "settings-tabpanel-users");
    const apiTokenPanel = tabpanels.find((p) => p.id === "settings-tabpanel-api-token");

    expect(usersPanel).toHaveAttribute("aria-labelledby", "settings-tab-users");
    expect(apiTokenPanel).toHaveAttribute("aria-labelledby", "settings-tab-api-token");
  });

  it("タブクリックで URL の ?tab パラメータが更新される", async () => {
    const { router } = renderApp("/admin");

    await screen.findByRole("tab", { name: /ワーカー管理/ });
    await userEvent.click(screen.getByRole("tab", { name: /API トークン設定/ }));

    await waitFor(() => {
      expect(router.state.location.searchStr).toContain("tab=api-token");
    });
  });
});

describe("APIキー入力欄 autocomplete 属性（#180）", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authApi, "fetchMe").mockResolvedValue({ id: "user1", displayName: "Alice", role: "admin" });
    vi.spyOn(adminApi, "useAdminSettings").mockReturnValue({
      data: [],
    } as ReturnType<typeof adminApi.useAdminSettings>);
  });

  it("Claude API キー欄に autocomplete='off' が設定されている", async () => {
    renderApp("/admin?tab=api-token", { id: "user1", displayName: "Alice", role: "admin" });
    const apiKeyInput = await screen.findByLabelText(/Claude API キー/);
    expect(apiKeyInput).toHaveAttribute("autocomplete", "off");
  });
});

describe("API トークン設定フォーム（#417 useForm 移行）", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authApi, "fetchMe").mockResolvedValue({ id: "user1", displayName: "Alice", role: "admin" });
    vi.spyOn(adminApi, "useAdminSettings").mockReturnValue({
      data: [],
    } as ReturnType<typeof adminApi.useAdminSettings>);
  });

  it("APIキーを入力して保存ボタンを押すと mutateAsync が呼ばれる", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(adminApi, "useSaveAdminSetting").mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof adminApi.useSaveAdminSetting>);

    renderApp("/admin?tab=api-token", { id: "user1", displayName: "Alice", role: "admin" });

    const input = await screen.findByLabelText(/Claude API キー/);
    await userEvent.type(input, "sk-ant-api03-test");
    await userEvent.click(screen.getByRole("button", { name: /保存/ }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ key: "CLAUDE_API_KEY", value: "sk-ant-api03-test" });
    });
  });

  it("保存成功後に入力フィールドがクリアされ成功地博れが表示される", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(adminApi, "useSaveAdminSetting").mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof adminApi.useSaveAdminSetting>);

    renderApp("/admin?tab=api-token", { id: "user1", displayName: "Alice", role: "admin" });

    const input = await screen.findByLabelText(/Claude API キー/);
    await userEvent.type(input, "sk-ant-api03-test");
    await userEvent.click(screen.getByRole("button", { name: /保存/ }));

    await waitFor(() => {
      expect(screen.getByText(/APIキーを保存しました/)).toBeInTheDocument();
    });
    expect(input).toHaveValue("");
  });

  it("保存失敗時にサーバから返るエラーメッセージが表示される（#476）", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error("Forbidden: 権限がありません"));
    vi.spyOn(adminApi, "useSaveAdminSetting").mockReturnValue({
      mutateAsync,
      isPending: false,
      isError: true,
      error: new Error("Forbidden: 権限がありません"),
      reset: vi.fn(),
    } as unknown as ReturnType<typeof adminApi.useSaveAdminSetting>);

    renderApp("/admin?tab=api-token", { id: "user1", displayName: "Alice", role: "admin" });

    const input = await screen.findByLabelText(/Claude API キー/);
    await userEvent.type(input, "invalid-key");
    await userEvent.click(screen.getByRole("button", { name: /保存/ }));

    // 汎用文言ではなく、サーバが返した具体的なエラー内容を表示する
    await waitFor(() => {
      expect(screen.getByText(/Forbidden: 権限がありません/)).toBeInTheDocument();
    });
  });

  it("mutation の isError=false ならエラーは表示されない（二重 state を持たず mutation 状態に従う・#476）", async () => {
    // mutateAsync は reject するが mutation 状態は成功扱い（isError=false）。
    // ローカル state での二重管理を廃したため、表示はあくまで mutation の isError に従う。
    vi.spyOn(adminApi, "useSaveAdminSetting").mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof adminApi.useSaveAdminSetting>);

    renderApp("/admin?tab=api-token", { id: "user1", displayName: "Alice", role: "admin" });

    const input = await screen.findByLabelText(/Claude API キー/);
    await userEvent.type(input, "sk-ant-api03-ok");
    await userEvent.click(screen.getByRole("button", { name: /保存/ }));

    await waitFor(() => {
      expect(screen.getByText(/APIキーを保存しました/)).toBeInTheDocument();
    });
    // エラー Snackbar の文言は出ない
    expect(screen.queryByText(/失敗/)).not.toBeInTheDocument();
  });

  it("保存中は保存ボタンが disabled になる", async () => {
    vi.spyOn(adminApi, "useSaveAdminSetting").mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: true,
    } as unknown as ReturnType<typeof adminApi.useSaveAdminSetting>);

    renderApp("/admin?tab=api-token", { id: "user1", displayName: "Alice", role: "admin" });

    const saveButton = await screen.findByRole("button", { name: /保存/ });
    expect(saveButton).toBeDisabled();
  });
});

/**
 * #463: 各タブのサーバ状態取得が useSuspenseQuery + QueryBoundary に移行されたことを検証する。
 * バッチログ／トークン使用量タブを実フックで描画し、global fetch をスタブして
 * 成功表示・ローディング fallback・取得失敗フォールバックを確認する。
 * （認証は fetchMe スパイで通すため、fetch スタブは各タブのデータ取得にのみ効く）
 */
describe("管理画面タブの Suspense / QueryBoundary（#463）", () => {
  function jsonResponse(status: number, body?: unknown): Response {
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(authApi, "fetchMe").mockResolvedValue({ id: "user1", displayName: "Alice", role: "admin" });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("バッチログタブ: 取得成功でログ行が表示される", async () => {
    // 各 fetch 呼び出しごとに新しい Response を返す（mockResolvedValue だと同一 Response
    // インスタンスが共有され、サイドバーの /api/communities など複数の並列 fetch で
    // body が二重読みされ "Body has already been read" になるため mockImplementation で都度生成する）。
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          jsonResponse(200, [
            {
              id: "log1",
              status: "success",
              messageCount: 3,
              errorMessage: null,
              errorCode: null,
              executedAt: "2026-06-01T00:00:00.000Z",
            },
          ]),
        ),
      ),
    );
    renderApp("/admin?tab=batch-logs", { id: "user1", displayName: "Alice", role: "admin" });

    expect(await screen.findByText(/直近 50 件のバッチ実行ログ/, undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(await screen.findByText("成功")).toBeInTheDocument();
  });

  it("バッチログタブ: 取得失敗で QueryBoundary の再試行フォールバックが表示される", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(500, { error: "boom" }))),
    );
    renderApp("/admin?tab=batch-logs", { id: "user1", displayName: "Alice", role: "admin" });

    // createQueryClient は retry:1 のため、リトライのバックオフ込みで待つ。
    expect(
      await screen.findByRole("button", { name: "再試行" }, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it("バッチログタブ: ローディング中は Suspense fallback（スケルトン）が表示される", async () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise<Response>(() => {})));
    renderApp("/admin?tab=batch-logs", { id: "user1", displayName: "Alice", role: "admin" });

    await waitFor(() =>
      expect(screen.getAllByTestId("batch-logs-skeleton").length).toBeGreaterThanOrEqual(1),
    );
  });

  it("トークン使用量タブ: 取得失敗で QueryBoundary の再試行フォールバックが表示される", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(500, { error: "boom" }))),
    );
    renderApp("/admin?tab=token-usage", { id: "user1", displayName: "Alice", role: "admin" });

    // createQueryClient は retry:1 のため、リトライのバックオフ込みで待つ。
    expect(
      await screen.findByRole("button", { name: "再試行" }, { timeout: 5000 }),
    ).toBeInTheDocument();
  });
});
