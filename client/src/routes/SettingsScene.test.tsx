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

describe("設定画面（#25）", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("ログイン済みでサイドバーの設定導線をクリックすると設定画面が表示される", async () => {
    vi.spyOn(authApi, "fetchMe").mockResolvedValue({ id: "user1", displayName: "Alice" });
    renderApp("/");

    const settingsLink = await screen.findByRole("link", { name: /設定/ });
    await userEvent.click(settingsLink);

    expect(await screen.findByRole("heading", { name: /設定/ })).toBeInTheDocument();
  });

  it("設定画面のユーザー一覧タブに全 AI ボットの表示名が表示される", async () => {
    vi.spyOn(authApi, "fetchMe").mockResolvedValue({ id: "user1", displayName: "Alice" });
    renderApp("/settings");

    expect(await screen.findByRole("tab", { name: /ユーザー一覧/ })).toBeInTheDocument();
    await waitFor(() => {
      for (const employee of DEFAULT_EMPLOYEES) {
        expect(screen.getByText(employee.displayName)).toBeInTheDocument();
      }
    });
  });
});
