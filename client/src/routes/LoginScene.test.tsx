import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("設定画面ガード", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("未ログイン状態で /settings にアクセスするとログイン画面が表示される", async () => {
    vi.spyOn(authApi, "fetchMe").mockResolvedValue(null);
    renderApp("/settings");
    expect(await screen.findByRole("heading", { name: /ログイン/ })).toBeInTheDocument();
  });

  it("ログイン済み状態で /settings にアクセスすると設定画面が表示される", async () => {
    vi.spyOn(authApi, "fetchMe").mockResolvedValue({ id: "user1", displayName: "Alice" });
    renderApp("/settings");
    expect(await screen.findByRole("heading", { name: /設定/ })).toBeInTheDocument();
  });
});

describe("ログインフォーム", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("フォームに入力してサブミットすると login API が呼ばれる", async () => {
    vi.spyOn(authApi, "fetchMe").mockResolvedValue(null);
    const loginSpy = vi.spyOn(authApi, "login").mockResolvedValue({ id: "user1", displayName: "Alice" });
    renderApp("/login");
    await userEvent.type(await screen.findByLabelText(/ID/), "user1");
    await userEvent.type(screen.getByLabelText(/パスワード/), "pass1");
    await userEvent.click(screen.getByRole("button", { name: /ログイン/ }));
    await waitFor(() => expect(loginSpy).toHaveBeenCalledWith({ id: "user1", password: "pass1" }));
  });
});
