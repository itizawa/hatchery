import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
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

describe("アカウント設定画面（#50）", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("/account にアクセスするとアカウント設定の見出しが表示される", async () => {
    vi.spyOn(authApi, "fetchMe").mockResolvedValue({ id: "user1", displayName: "Alice" });
    renderApp("/account");

    expect(await screen.findByRole("heading", { name: /アカウント設定/ })).toBeInTheDocument();
  });

  it("ログイン済み時はサイドバーに「アカウント設定」リンクが表示される", async () => {
    vi.spyOn(authApi, "fetchMe").mockResolvedValue({ id: "user1", displayName: "Alice" });
    renderApp("/");

    expect(await screen.findByRole("link", { name: "アカウント設定" })).toBeInTheDocument();
  });

  it("未ログイン時はサイドバーに「アカウント設定」リンクが表示されない", async () => {
    vi.spyOn(authApi, "fetchMe").mockResolvedValue(null);
    renderApp("/");

    // サイドバーが表示されるまで待つ（「Hatchery」テキストが常に描画される）
    await screen.findByText("Hatchery");
    expect(screen.queryByRole("link", { name: "アカウント設定" })).not.toBeInTheDocument();
  });
});
