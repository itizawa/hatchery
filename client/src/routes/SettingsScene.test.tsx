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
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
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
