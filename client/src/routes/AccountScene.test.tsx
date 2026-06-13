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
      // ホームフィードは { posts, nextCursor } 形を返す（HomeFeedScene が pages.posts を flatMap するため）。
      if (url.includes("/api/feed")) {
        return Promise.resolve(jsonResponse(200, { posts: [], nextCursor: null }));
      }
      return Promise.resolve(jsonResponse(200, []));
    }),
  );
}

/**
 * /account を描画するテスト用に、シェル（AppHeader/サイドバー）と requireAuth ガードの両方が呼ぶ
 * fetch を一括スタブする。#461 で useAuth が useSuspenseQuery 化され、シェルの useAuth は
 * モジュール内ローカル参照の fetchMe を呼ぶため `vi.spyOn(authApi, "fetchMe")` だけでは届かず、
 * グローバル fetch を確実にスタブする必要がある（未スタブだと実ネットワークへ出て失敗・throw する）。
 */
function stubAuthFetch(user: { id: string; displayName: string; avatarUrl?: string } | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/auth/me")) {
        return Promise.resolve(jsonResponse(user ? 200 : 401, user ?? undefined));
      }
      if (url.includes("/api/feed")) {
        return Promise.resolve(jsonResponse(200, { posts: [], nextCursor: null }));
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

describe("AccountScene ローディング（#241 / #461: Suspense へ委譲）", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // #461: useAuth が useSuspenseQuery 化され、認証ローディングはルートの Suspense に委譲される。
  // 認証が解決するまでアカウント設定フォーム（見出し）は描画されず、解決後に表示される。
  it("認証ローディング中はアカウント設定見出しを表示せず、解決後に表示する", async () => {
    // /auth/me の応答を遅延制御する。シェルの useAuth・requireAuth ガードが各々 fetch するため
    // 複数の保留プロミスを全て解決できるよう、解放フラグ + 保留リストで管理する。
    let released = false;
    const pending: Array<(res: Response) => void> = [];
    const meResponse = () => jsonResponse(200, { id: "user1", displayName: "Alice" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url.includes("/auth/me")) {
          if (released) return Promise.resolve(meResponse());
          return new Promise<Response>((resolve) => {
            pending.push(resolve);
          });
        }
        if (url.includes("/api/feed")) {
          return Promise.resolve(jsonResponse(200, { posts: [], nextCursor: null }));
        }
        return Promise.resolve(jsonResponse(200, []));
      }),
    );
    renderApp("/account");

    // 認証未解決の間は見出しが出ない（per-scene スケルトンは廃止し Suspense に委譲）。
    expect(screen.queryByRole("heading", { name: /アカウント設定/ })).not.toBeInTheDocument();

    released = true;
    pending.forEach((resolve) => resolve(meResponse()));

    expect(await screen.findByRole("heading", { name: /アカウント設定/ })).toBeInTheDocument();
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
    stubAuthFetch({ id: "user1", displayName: "Alice" });
    renderApp("/account");

    expect(await screen.findByRole("heading", { name: /アカウント設定/ })).toBeInTheDocument();
  });

  it("未ログイン状態で /account にアクセスするとログイン画面が表示される", async () => {
    stubAuthFetch(null);
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

  it("avatarUrl に不正な URL を入力したとき保存ボタンが無効化またはエラーが表示される（#187）", async () => {
    stubAuthFetch({ id: "user1", displayName: "Alice" });
    renderApp("/account");

    const avatarInput = await screen.findByRole("textbox", { name: /プロフィール画像 URL/ });
    await userEvent.type(avatarInput, "not-a-url");
    await userEvent.tab(); // blur してバリデーションを発火

    await waitFor(() => {
      const hasError = screen.queryByText(/有効な URL/) !== null;
      expect(hasError).toBe(true);
    });
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
