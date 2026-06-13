import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

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

describe("管理画面ガード", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("未ログイン状態で /admin にアクセスするとログイン画面が表示される", async () => {
    vi.spyOn(authApi, "fetchMe").mockResolvedValue(null);
    renderApp("/admin");
    expect(await screen.findByRole("heading", { name: /ログイン/ })).toBeInTheDocument();
  });

  it("ログイン済み状態で /admin にアクセスすると管理画面が表示される", async () => {
    vi.spyOn(authApi, "fetchMe").mockResolvedValue({ id: "user1", email: "user1@example.com", displayName: "Alice", role: "admin" });
    renderApp("/admin");
    expect(await screen.findByRole("heading", { name: /管理画面/ })).toBeInTheDocument();
  });
});

describe("ログイン画面（#455: Google 認証のみ）", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("ログイン画面に Google でログインボタンが表示される", async () => {
    vi.spyOn(authApi, "fetchMe").mockResolvedValue(null);
    renderApp("/login");
    expect(await screen.findByRole("button", { name: /Google でログイン/ })).toBeInTheDocument();
  });

  it("ログイン画面に ID/パスワードフォームが存在しない（#455）", async () => {
    vi.spyOn(authApi, "fetchMe").mockResolvedValue(null);
    renderApp("/login");
    await screen.findByRole("button", { name: /Google でログイン/ });
    expect(screen.queryByLabelText(/ID/)).toBeNull();
    expect(screen.queryByLabelText(/パスワード/)).toBeNull();
  });
});
