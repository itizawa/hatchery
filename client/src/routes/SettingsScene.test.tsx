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
// eslint-disable-next-line max-params
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

  it("管理画面（/admin）のワーカー管理タブに「ワーカーを追加」ボタンが表示される（#217）", async () => {
    vi.spyOn(authApi, "fetchMe").mockResolvedValue({ id: "user1", displayName: "Alice", role: "admin" });
    vi.spyOn(adminApi, "useAdminWorkers").mockReturnValue({
      data: { workers: DEFAULT_WORKERS.map((w) => ({ ...w })), total: DEFAULT_WORKERS.length, page: 1, limit: 10 },
    } as ReturnType<typeof adminApi.useAdminWorkers>);
    renderApp("/admin");

    expect(await screen.findByRole("tab", { name: /ワーカー管理/ })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "ワーカーを追加" })).toBeInTheDocument();
    });
  });
});

describe("設定画面タブ URL 同期・アクセシビリティ（#67）", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authApi, "fetchMe").mockResolvedValue({ id: "user1", displayName: "Alice", role: "admin" });
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
  });

  it("各タブに id='settings-tab-{value}' が設定されている", async () => {
    renderApp("/admin");

    expect(await screen.findByRole("tab", { name: /ワーカー管理/ })).toHaveAttribute(
      "id",
      "settings-tab-users",
    );
    expect(screen.getByRole("tab", { name: /バッチログ/ })).toHaveAttribute(
      "id",
      "settings-tab-batch-logs",
    );
  });

  it("各タブパネルに id・aria-labelledby が設定されている", async () => {
    renderApp("/admin");

    await screen.findByRole("tab", { name: /ワーカー管理/ });

    const tabpanels = screen.getAllByRole("tabpanel", { hidden: true });
    const usersPanel = tabpanels.find((p) => p.id === "settings-tabpanel-users");

    expect(usersPanel).toHaveAttribute("aria-labelledby", "settings-tab-users");
  });

  it("タブクリックで URL の ?tab パラメータが更新される", async () => {
    const { router } = renderApp("/admin");

    await screen.findByRole("tab", { name: /ワーカー管理/ });
    await userEvent.click(screen.getByRole("tab", { name: /バッチログ/ }));

    await waitFor(() => {
      expect(router.state.location.searchStr).toContain("tab=batch-logs");
    });
  });

  it("管理画面のタブに「API トークン設定」が存在しない（#662）", async () => {
    renderApp("/admin");

    await screen.findByRole("tab", { name: /ワーカー管理/ });
    expect(screen.queryByRole("tab", { name: /API トークン設定/ })).not.toBeInTheDocument();
  });
});

/**
 * #463: 各タブのサーバ状態取得が useSuspenseQuery + QueryBoundary に移行されたことを検証する。
 * バッチログ／トークン使用量タブを実フックで描画し、global fetch をスタブして
 * 成功表示・ローディング fallback・取得失敗フォールバックを確認する。
 * （認証は fetchMe スパイで通すため、fetch スタブは各タブのデータ取得にのみ効く）
 */
describe("管理画面タブの Suspense / QueryBoundary（#463）", () => {
  // eslint-disable-next-line max-params
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

  it("トークン使用量タブ: 取得成功で合計コスト（$）とグラフが表示される（#664）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          jsonResponse(200, {
            logs: [
              {
                id: "t1",
                occurredAt: "2026-06-01T00:00:00Z",
                model: "claude-haiku-4-5",
                inputTokens: 1_000_000,
                outputTokens: 1_000_000,
                batchRunLogId: null,
              },
            ],
            summary: {
              totalInputTokens: 1_000_000,
              totalOutputTokens: 1_000_000,
              totalTokens: 2_000_000,
              totalCostUsd: 6,
            },
          }),
        ),
      ),
    );
    renderApp("/admin?tab=token-usage", { id: "user1", displayName: "Alice", role: "admin" });

    // 合計コストが $ 表示される
    expect(await screen.findByText(/\$6\.000000/, undefined, { timeout: 3000 })).toBeInTheDocument();
    // 日別コストグラフが描画される
    expect(screen.getByRole("img", { name: /日別コスト推移グラフ/ })).toBeInTheDocument();
    // グラフのバーが少なくとも 1 本ある
    expect(screen.getAllByTestId("daily-cost-bar").length).toBeGreaterThanOrEqual(1);
  });
});
