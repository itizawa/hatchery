import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "../queryClient.js";
import { createAppRouter } from "../router.js";

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const activeInvitation = { status: "active", expiresAt: "2099-01-01T00:00:00Z" };
const sampleUser = { id: "newuser", displayName: "New User" };

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

describe("AcceptInvitationScene", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("有効なトークン（status=active）では登録フォームが表示される", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((input: Request | string | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/auth/me")) return Promise.resolve(jsonResponse(401, null));
      if (url.match(/\/invitations\/[^/]+$/)) return Promise.resolve(jsonResponse(200, activeInvitation));
      return Promise.resolve(jsonResponse(200, {}));
    }));

    renderApp("/invite/valid-token");

    expect(await screen.findByRole("heading", { name: /新規登録/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/ログイン ID/)).toBeInTheDocument();
    expect(screen.getByLabelText(/表示名/)).toBeInTheDocument();
    expect(screen.getByLabelText(/パスワード/)).toBeInTheDocument();
  });

  it("使用済みトークン（status=used）ではエラーメッセージが表示されフォームがない", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((input: Request | string | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/auth/me")) return Promise.resolve(jsonResponse(401, null));
      if (url.match(/\/invitations\/[^/]+$/))
        return Promise.resolve(jsonResponse(200, { status: "used", expiresAt: "2020-01-01T00:00:00Z" }));
      return Promise.resolve(jsonResponse(200, {}));
    }));

    renderApp("/invite/used-token");

    expect(await screen.findByText(/使用済み/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /新規登録/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ログインページ/ })).toBeInTheDocument();
  });

  it("期限切れトークン（status=expired）ではエラーメッセージが表示されフォームがない", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((input: Request | string | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/auth/me")) return Promise.resolve(jsonResponse(401, null));
      if (url.match(/\/invitations\/[^/]+$/))
        return Promise.resolve(jsonResponse(200, { status: "expired", expiresAt: "2020-01-01T00:00:00Z" }));
      return Promise.resolve(jsonResponse(200, {}));
    }));

    renderApp("/invite/expired-token");

    expect(await screen.findByText(/期限切れ/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /新規登録/ })).not.toBeInTheDocument();
  });

  it("存在しないトークン（404）ではエラーメッセージが表示されフォームがない", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((input: Request | string | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/auth/me")) return Promise.resolve(jsonResponse(401, null));
      if (url.match(/\/invitations\/[^/]+$/)) return Promise.resolve(jsonResponse(404, { error: "Not found" }));
      return Promise.resolve(jsonResponse(200, {}));
    }));

    renderApp("/invite/nonexistent-token");

    expect(await screen.findByText(/見つかりません/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /新規登録/ })).not.toBeInTheDocument();
  });

  it("受諾成功時は acceptInvitation が正しい引数で呼ばれ / へ遷移する", async () => {
    let isLoggedIn = false;
    const fetchMock = vi.fn().mockImplementation((input: Request | string | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/auth/me")) {
        return Promise.resolve(isLoggedIn ? jsonResponse(200, sampleUser) : jsonResponse(401, null));
      }
      if (url.includes("/accept")) {
        isLoggedIn = true;
        return Promise.resolve(jsonResponse(201, sampleUser));
      }
      if (url.match(/\/invitations\/[^/]+$/)) return Promise.resolve(jsonResponse(200, activeInvitation));
      return Promise.resolve(jsonResponse(200, []));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderApp("/invite/valid-token");

    await userEvent.type(await screen.findByLabelText(/ログイン ID/), "newuser");
    await userEvent.type(screen.getByLabelText(/表示名/), "New User");
    await userEvent.type(screen.getByLabelText(/パスワード/), "password123");
    await userEvent.click(screen.getByRole("button", { name: /登録/ }));

    // 受諾 API が呼ばれたことを確認
    await waitFor(() => {
      const acceptCall = fetchMock.mock.calls.find(([req]) => {
        const url = req instanceof Request ? req.url : String(req);
        return url.includes("/accept");
      });
      expect(acceptCall).toBeDefined();
    });

    // / へ遷移してタイムラインが表示される
    expect(await screen.findByRole("heading", { name: /タイムライン/ })).toBeInTheDocument();
  });

  it("ID 重複（409）のとき「この ID は既に使われています」が表示される", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((input: Request | string | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/auth/me")) return Promise.resolve(jsonResponse(401, null));
      if (url.includes("/accept"))
        return Promise.resolve(jsonResponse(409, { error: "User id already exists" }));
      if (url.match(/\/invitations\/[^/]+$/)) return Promise.resolve(jsonResponse(200, activeInvitation));
      return Promise.resolve(jsonResponse(200, {}));
    }));

    renderApp("/invite/valid-token");

    await userEvent.type(await screen.findByLabelText(/ログイン ID/), "existinguser");
    await userEvent.type(screen.getByLabelText(/表示名/), "New User");
    await userEvent.type(screen.getByLabelText(/パスワード/), "password123");
    await userEvent.click(screen.getByRole("button", { name: /登録/ }));

    expect(await screen.findByText(/既に使われています/)).toBeInTheDocument();
  });

  it("ログイン済みのユーザーがアクセスすると / へリダイレクトされる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((input: Request | string | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/auth/me")) return Promise.resolve(jsonResponse(200, { id: "user1", displayName: "Alice" }));
      if (url.match(/\/invitations\/[^/]+$/)) return Promise.resolve(jsonResponse(200, activeInvitation));
      return Promise.resolve(jsonResponse(200, []));
    }));

    renderApp("/invite/valid-token");

    // ログイン済みなので / へリダイレクト → タイムラインが表示される
    expect(await screen.findByRole("heading", { name: /タイムライン/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /新規登録/ })).not.toBeInTheDocument();
  });
});
