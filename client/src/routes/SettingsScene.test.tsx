import * as invitationsApi from "../api/invitations.js";
import * as adminApi from "../api/admin.js";
import * as employeesApi from "../api/employees.js";
import { DEFAULT_EMPLOYEES } from "@hatchery/common";
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

  it("ログイン済みでサイドバーの「管理画面」リンクをクリックすると管理画面が表示される", async () => {
    const adminUser = { id: "user1", displayName: "Alice", role: "admin" as const };
    vi.spyOn(authApi, "fetchMe").mockResolvedValue(adminUser);
    renderApp("/", adminUser);

    const adminLink = await screen.findByRole("link", { name: "管理画面" });
    await userEvent.click(adminLink);

    expect(await screen.findByRole("heading", { name: /管理画面/ })).toBeInTheDocument();
  });

  it("管理画面（/admin）のワーカー管理タブに全 AI ボットの表示名が表示される", async () => {
    vi.spyOn(authApi, "fetchMe").mockResolvedValue({ id: "user1", displayName: "Alice", role: "admin" });
    vi.spyOn(employeesApi, "useBotEmployees").mockReturnValue({
      data: [...DEFAULT_EMPLOYEES],
      isLoading: false,
    } as ReturnType<typeof employeesApi.useBotEmployees>);
    renderApp("/admin");

    expect(await screen.findByRole("tab", { name: /ワーカー管理/ })).toBeInTheDocument();
    await waitFor(() => {
      for (const employee of DEFAULT_EMPLOYEES) {
        expect(screen.getByText(employee.displayName)).toBeInTheDocument();
      }
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
      isLoading: false,
    } as ReturnType<typeof adminApi.useAdminSettings>);
  });

  it("Claude API キー欄に autocomplete='off' が設定されている", async () => {
    renderApp("/admin?tab=api-token", { id: "user1", displayName: "Alice", role: "admin" });
    const apiKeyInput = await screen.findByLabelText(/Claude API キー/);
    expect(apiKeyInput).toHaveAttribute("autocomplete", "off");
  });
});

describe("招待タブ（#133）", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authApi, "fetchMe").mockResolvedValue({ id: "user1", displayName: "Alice", role: "admin" });
    vi.spyOn(invitationsApi, "fetchInvitations").mockResolvedValue([]);
  });

  it("「招待」タブが表示される", async () => {
    renderApp("/admin");
    expect(await screen.findByRole("tab", { name: /招待/ })).toBeInTheDocument();
  });

  it("?tab=invitations で開くと「招待」タブがアクティブになる", async () => {
    renderApp("/admin?tab=invitations");
    const invitationsTab = await screen.findByRole("tab", { name: /招待/ });
    expect(invitationsTab).toHaveAttribute("aria-selected", "true");
  });

  it("「招待」タブをクリックすると URL が ?tab=invitations になる", async () => {
    const { router } = renderApp("/admin");
    await screen.findByRole("tab", { name: /ワーカー管理/ });
    await userEvent.click(screen.getByRole("tab", { name: /招待/ }));

    await waitFor(() => {
      expect(router.state.location.searchStr).toContain("tab=invitations");
    });
  });
});
