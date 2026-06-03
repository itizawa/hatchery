import { DEFAULT_EMPLOYEES } from "@hatchery/common";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as authApi from "../api/auth.js";
import { createQueryClient } from "../queryClient.js";
import { createAppRouter } from "../router.js";

function renderApp(initialPath: string) {
  const queryClient = createQueryClient();
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
    vi.spyOn(authApi, "fetchMe").mockResolvedValue({ id: "user1", displayName: "Alice" });
    renderApp("/");

    const adminLink = await screen.findByRole("link", { name: "管理画面" });
    await userEvent.click(adminLink);

    expect(await screen.findByRole("heading", { name: /管理画面/ })).toBeInTheDocument();
  });

  it("管理画面（/admin）のユーザー一覧タブに全 AI ボットの表示名が表示される", async () => {
    vi.spyOn(authApi, "fetchMe").mockResolvedValue({ id: "user1", displayName: "Alice" });
    renderApp("/admin");

    expect(await screen.findByRole("tab", { name: /ユーザー一覧/ })).toBeInTheDocument();
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
    vi.spyOn(authApi, "fetchMe").mockResolvedValue({ id: "user1", displayName: "Alice" });
  });

  it("?tab=api-token で開くと「API トークン設定」タブがアクティブになる", async () => {
    renderApp("/admin?tab=api-token");

    const apiTokenTab = await screen.findByRole("tab", { name: /API トークン設定/ });
    expect(apiTokenTab).toHaveAttribute("aria-selected", "true");
  });

  it("?tab= 無し（デフォルト）で開くと「ユーザー一覧」タブがアクティブになる", async () => {
    renderApp("/admin");

    const usersTab = await screen.findByRole("tab", { name: /ユーザー一覧/ });
    expect(usersTab).toHaveAttribute("aria-selected", "true");
  });

  it("?tab=invalid（不正値）で開くと「ユーザー一覧」タブにフォールバックする", async () => {
    renderApp("/admin?tab=invalid");

    const usersTab = await screen.findByRole("tab", { name: /ユーザー一覧/ });
    expect(usersTab).toHaveAttribute("aria-selected", "true");

    const apiTokenTab = screen.getByRole("tab", { name: /API トークン設定/ });
    expect(apiTokenTab).toHaveAttribute("aria-selected", "false");
  });

  it("各タブに id='settings-tab-{value}' が設定されている", async () => {
    renderApp("/admin");

    expect(await screen.findByRole("tab", { name: /ユーザー一覧/ })).toHaveAttribute(
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

    await screen.findByRole("tab", { name: /ユーザー一覧/ });

    const tabpanels = screen.getAllByRole("tabpanel", { hidden: true });
    const usersPanel = tabpanels.find((p) => p.id === "settings-tabpanel-users");
    const apiTokenPanel = tabpanels.find((p) => p.id === "settings-tabpanel-api-token");

    expect(usersPanel).toHaveAttribute("aria-labelledby", "settings-tab-users");
    expect(apiTokenPanel).toHaveAttribute("aria-labelledby", "settings-tab-api-token");
  });

  it("タブクリックで URL の ?tab パラメータが更新される", async () => {
    const { router } = renderApp("/admin");

    await screen.findByRole("tab", { name: /ユーザー一覧/ });
    await userEvent.click(screen.getByRole("tab", { name: /API トークン設定/ }));

    await waitFor(() => {
      expect(router.state.location.searchStr).toContain("tab=api-token");
    });
  });
});
