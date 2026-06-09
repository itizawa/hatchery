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
    vi.spyOn(authApi, "fetchMe").mockResolvedValue({ id: "user1", displayName: "Alice", role: "admin" });
    renderApp("/admin");
    expect(await screen.findByRole("heading", { name: /管理画面/ })).toBeInTheDocument();
  });
});

describe("autocomplete 属性（#180）", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("ID 入力欄に autocomplete='username' が設定されている", async () => {
    vi.spyOn(authApi, "fetchMe").mockResolvedValue(null);
    renderApp("/login");
    const idInput = await screen.findByLabelText(/ID/);
    expect(idInput).toHaveAttribute("autocomplete", "username");
  });

  it("パスワード入力欄に autocomplete='current-password' が設定されている", async () => {
    vi.spyOn(authApi, "fetchMe").mockResolvedValue(null);
    renderApp("/login");
    await screen.findByLabelText(/ID/);
    const passwordInput = screen.getByLabelText(/パスワード/);
    expect(passwordInput).toHaveAttribute("autocomplete", "current-password");
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
    await waitFor(() => expect(loginSpy).toHaveBeenCalledWith({ loginId: "user1", password: "pass1" }));
  });

  it("ID フィールドが空の場合、送信しても login API が呼ばれない", async () => {
    vi.spyOn(authApi, "fetchMe").mockResolvedValue(null);
    const loginSpy = vi.spyOn(authApi, "login").mockResolvedValue({ id: "user1", displayName: "Alice" });
    renderApp("/login");
    await screen.findByLabelText(/ID/);
    await userEvent.type(screen.getByLabelText(/パスワード/), "pass1");
    await userEvent.click(screen.getByRole("button", { name: /ログイン/ }));
    await waitFor(() => expect(loginSpy).not.toHaveBeenCalled());
  });

  it("パスワードフィールドが空の場合、送信しても login API が呼ばれない", async () => {
    vi.spyOn(authApi, "fetchMe").mockResolvedValue(null);
    const loginSpy = vi.spyOn(authApi, "login").mockResolvedValue({ id: "user1", displayName: "Alice" });
    renderApp("/login");
    await userEvent.type(await screen.findByLabelText(/ID/), "user1");
    await userEvent.click(screen.getByRole("button", { name: /ログイン/ }));
    await waitFor(() => expect(loginSpy).not.toHaveBeenCalled());
  });
});
