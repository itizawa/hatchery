import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as authApi from "../api/auth.js";
import { createQueryClient } from "../queryClient.js";
import { createAppRouter } from "../router.js";

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubFetch(isLoggedIn: boolean) {
  const user = isLoggedIn ? { id: "user1", displayName: "Alice" } : undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/auth/me")) {
        return Promise.resolve(jsonResponse(isLoggedIn ? 200 : 401, user));
      }
      return Promise.resolve(jsonResponse(200, []));
    }),
  );
}

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

describe("AccountScene スケルトン UI（#241）", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("useAuth() が isLoading=true のときスケルトンが表示される", async () => {
    vi.spyOn(authApi, "fetchMe").mockResolvedValue({ id: "user1", displayName: "Alice" });
    vi.spyOn(authApi, "useAuth").mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof authApi.useAuth>);
    renderApp("/account");

    expect(await screen.findByTestId("account-scene-skeleton")).toBeInTheDocument();
  });
});

describe("アカウント設定画面（#50）", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ログイン済みで /account にアクセスするとアカウント設定の見出しが表示される", async () => {
    vi.spyOn(authApi, "fetchMe").mockResolvedValue({ id: "user1", displayName: "Alice" });
    renderApp("/account");

    expect(await screen.findByRole("heading", { name: /アカウント設定/ })).toBeInTheDocument();
  });

  it("未ログイン状態で /account にアクセスするとログイン画面が表示される", async () => {
    vi.spyOn(authApi, "fetchMe").mockResolvedValue(null);
    renderApp("/account");

    expect(await screen.findByRole("heading", { name: /ログイン/ })).toBeInTheDocument();
  });

  it("ログイン済み時はサイドバーのメニューに「アカウント設定」が表示される", async () => {
    stubFetch(true);
    renderApp("/");

    const trigger = await screen.findByRole("button", { name: /ユーザーメニュー/ });
    await userEvent.click(trigger);

    expect(await screen.findByRole("menuitem", { name: "アカウント設定" })).toBeInTheDocument();
  });

  it("未ログイン時はサイドバーにユーザーメニュートリガーが表示されない", async () => {
    stubFetch(false);
    renderApp("/");

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /ユーザーメニュー/ })).not.toBeInTheDocument();
    });
  });
});

describe("プロフィール編集フォーム (#51)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("displayName が空のとき保存ボタンが無効化される", async () => {
    const mockUser = { id: "user1", displayName: "Alice" };
    vi.spyOn(authApi, "fetchMe").mockResolvedValue(mockUser);
    vi.spyOn(authApi, "useAuth").mockReturnValue({
      data: mockUser,
      isLoading: false,
    } as ReturnType<typeof authApi.useAuth>);
    renderApp("/account");

    const input = await screen.findByDisplayValue("Alice");
    await userEvent.clear(input);

    const button = screen.getByRole("button", { name: /保存/ });
    expect(button).toBeDisabled();
  });

  it("保存ボタン押下で updateProfile が呼ばれる", async () => {
    const mockUser = { id: "user1", displayName: "Alice" };
    const mockUpdate = vi.spyOn(authApi, "updateProfile").mockResolvedValue({
      id: "user1",
      displayName: "New Name",
    });
    vi.spyOn(authApi, "fetchMe").mockResolvedValue(mockUser);
    vi.spyOn(authApi, "useAuth").mockReturnValue({
      data: mockUser,
      isLoading: false,
    } as ReturnType<typeof authApi.useAuth>);
    renderApp("/account");

    const input = await screen.findByDisplayValue("Alice");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");

    const button = screen.getByRole("button", { name: /保存/ });
    await userEvent.click(button);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ displayName: "New Name" }));
    });
  });

  it("保存成功時にスナックバーが表示される", async () => {
    const mockUser = { id: "user1", displayName: "Alice" };
    vi.spyOn(authApi, "updateProfile").mockResolvedValue({
      id: "user1",
      displayName: "New Name",
    });
    vi.spyOn(authApi, "fetchMe").mockResolvedValue(mockUser);
    vi.spyOn(authApi, "useAuth").mockReturnValue({
      data: mockUser,
      isLoading: false,
    } as ReturnType<typeof authApi.useAuth>);
    renderApp("/account");

    const input = await screen.findByDisplayValue("Alice");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");

    const button = screen.getByRole("button", { name: /保存/ });
    await userEvent.click(button);

    expect(await screen.findByText(/保存しました/)).toBeInTheDocument();
  });
});

describe("編集フォームのdirty判定 (#179)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("変更なし → 保存ボタンが disabled", async () => {
    const mockUser = { id: "user1", displayName: "Alice" };
    vi.spyOn(authApi, "fetchMe").mockResolvedValue(mockUser);
    vi.spyOn(authApi, "useAuth").mockReturnValue({
      data: mockUser,
      isLoading: false,
    } as ReturnType<typeof authApi.useAuth>);
    renderApp("/account");

    await screen.findByDisplayValue("Alice");

    expect(screen.getByRole("button", { name: /保存/ })).toBeDisabled();
  });

  it("変更あり → 保存ボタンが enabled", async () => {
    const mockUser = { id: "user1", displayName: "Alice" };
    vi.spyOn(authApi, "fetchMe").mockResolvedValue(mockUser);
    vi.spyOn(authApi, "useAuth").mockReturnValue({
      data: mockUser,
      isLoading: false,
    } as ReturnType<typeof authApi.useAuth>);
    renderApp("/account");

    const input = await screen.findByDisplayValue("Alice");
    await userEvent.clear(input);
    await userEvent.type(input, "Bob");

    expect(screen.getByRole("button", { name: /保存/ })).not.toBeDisabled();
  });

  it("変更後に初期値へ戻す → 保存ボタンが disabled", async () => {
    const mockUser = { id: "user1", displayName: "Alice" };
    vi.spyOn(authApi, "fetchMe").mockResolvedValue(mockUser);
    vi.spyOn(authApi, "useAuth").mockReturnValue({
      data: mockUser,
      isLoading: false,
    } as ReturnType<typeof authApi.useAuth>);
    renderApp("/account");

    const input = await screen.findByDisplayValue("Alice");
    await userEvent.clear(input);
    await userEvent.type(input, "Bob");
    await userEvent.clear(input);
    await userEvent.type(input, "Alice");

    expect(screen.getByRole("button", { name: /保存/ })).toBeDisabled();
  });
});
