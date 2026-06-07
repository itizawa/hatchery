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

const sampleAuthUser = { id: "newuser", displayName: "新ユーザー", role: "member" };

function stubFetch({
  isLoggedIn = false,
  invitationStatus,
  acceptResult,
}: {
  isLoggedIn?: boolean;
  invitationStatus?: "active" | "used" | "expired" | "revoked" | "notfound";
  acceptResult?: { status: number; body?: unknown };
}) {
  const user = isLoggedIn ? { id: "user1", displayName: "Alice", role: "member" } : null;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);

      if (url.includes("/api/auth/me")) {
        return Promise.resolve(jsonResponse(isLoggedIn ? 200 : 401, user ?? undefined));
      }

      if (url.includes("/accept")) {
        if (acceptResult) {
          return Promise.resolve(jsonResponse(acceptResult.status, acceptResult.body));
        }
        return Promise.resolve(jsonResponse(201, sampleAuthUser));
      }

      if (url.includes("/api/invitations/")) {
        if (invitationStatus === "notfound") {
          return Promise.resolve(jsonResponse(404, { error: "Not found" }));
        }
        return Promise.resolve(
          jsonResponse(200, {
            status: invitationStatus ?? "active",
            expiresAt: "2099-12-31T00:00:00Z",
          }),
        );
      }

      return Promise.resolve(jsonResponse(200, {}));
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

describe("招待リンク受諾画面（#134）", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("トークンが active の場合", () => {
    it("/invite/:token に未ログインでアクセスすると登録フォームが表示される", async () => {
      stubFetch({ isLoggedIn: false, invitationStatus: "active" });
      renderApp("/invite/valid-token");

      expect(await screen.findByRole("heading", { name: /ユーザー登録/ })).toBeInTheDocument();
      expect(screen.getByLabelText(/ログイン ID/)).toBeInTheDocument();
      expect(screen.getByLabelText(/表示名/)).toBeInTheDocument();
      expect(screen.getByLabelText(/パスワード/)).toBeInTheDocument();
    });
  });

  describe("トークンが無効な場合（フォームを出さない）", () => {
    it("status=used のとき「使用済み」メッセージが表示される", async () => {
      stubFetch({ isLoggedIn: false, invitationStatus: "used" });
      renderApp("/invite/used-token");

      expect(await screen.findByText(/使用済み/)).toBeInTheDocument();
      expect(screen.queryByLabelText(/ログイン ID/)).not.toBeInTheDocument();
    });

    it("status=expired のとき「有効期限」メッセージが表示される", async () => {
      stubFetch({ isLoggedIn: false, invitationStatus: "expired" });
      renderApp("/invite/expired-token");

      expect(await screen.findByText(/有効期限/)).toBeInTheDocument();
      expect(screen.queryByLabelText(/ログイン ID/)).not.toBeInTheDocument();
    });

    it("status=revoked のとき「無効化」メッセージが表示される", async () => {
      stubFetch({ isLoggedIn: false, invitationStatus: "revoked" });
      renderApp("/invite/revoked-token");

      expect(await screen.findByText(/無効化/)).toBeInTheDocument();
      expect(screen.queryByLabelText(/ログイン ID/)).not.toBeInTheDocument();
    });

    it("404（存在しないトークン）のとき「無効」メッセージが表示される", async () => {
      stubFetch({ isLoggedIn: false, invitationStatus: "notfound" });
      renderApp("/invite/nosuchtoken");

      expect(await screen.findByText(/無効/)).toBeInTheDocument();
      expect(screen.queryByLabelText(/ログイン ID/)).not.toBeInTheDocument();
    });

    it("500 サーバーエラーのとき「サーバーエラー」メッセージが表示される（notfound とは別メッセージ）", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation((input: RequestInfo | URL) => {
          const url = input instanceof Request ? input.url : String(input);
          if (url.includes("/api/auth/me")) return Promise.resolve(jsonResponse(401, undefined));
          if (url.includes("/api/invitations/")) return Promise.resolve(jsonResponse(500, { error: "Server Error" }));
          return Promise.resolve(jsonResponse(200, {}));
        }),
      );
      renderApp("/invite/errtoken");

      expect(await screen.findByText(/サーバーエラー/)).toBeInTheDocument();
      expect(screen.queryByText(/無効です。招待リンクが正しいか/)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/ログイン ID/)).not.toBeInTheDocument();
    });

    it("無効メッセージの画面にログインへのリンクが表示される", async () => {
      stubFetch({ isLoggedIn: false, invitationStatus: "used" });
      renderApp("/invite/used-token");

      expect(await screen.findByRole("link", { name: /ログイン/ })).toBeInTheDocument();
    });
  });

  describe("フォーム送信", () => {
    it("フォームに入力して送信すると acceptInvitation が呼ばれる", async () => {
      stubFetch({ isLoggedIn: false, invitationStatus: "active" });
      renderApp("/invite/valid-token");

      await userEvent.type(await screen.findByLabelText(/ログイン ID/), "newuser");
      await userEvent.type(screen.getByLabelText(/表示名/), "新ユーザー");
      await userEvent.type(screen.getByLabelText(/パスワード/), "password123");
      await userEvent.click(screen.getByRole("button", { name: /登録/ }));

      await waitFor(() => {
        expect(screen.queryByRole("heading", { name: /ユーザー登録/ })).not.toBeInTheDocument();
      });
    });

    it("ID 重複（409）のとき「既に使われています」エラーメッセージが表示される", async () => {
      stubFetch({
        isLoggedIn: false,
        invitationStatus: "active",
        acceptResult: { status: 409, body: { error: "User id already exists" } },
      });
      renderApp("/invite/valid-token");

      await userEvent.type(await screen.findByLabelText(/ログイン ID/), "duplicate");
      await userEvent.type(screen.getByLabelText(/表示名/), "テスト");
      await userEvent.type(screen.getByLabelText(/パスワード/), "password123");
      await userEvent.click(screen.getByRole("button", { name: /登録/ }));

      expect(await screen.findByText(/既に使われています/)).toBeInTheDocument();
    });

    it("受諾中に無効化（409）のとき「招待リンクが無効」エラーメッセージが表示される", async () => {
      stubFetch({
        isLoggedIn: false,
        invitationStatus: "active",
        acceptResult: { status: 409, body: { error: "Invitation is no longer active" } },
      });
      renderApp("/invite/valid-token");

      await userEvent.type(await screen.findByLabelText(/ログイン ID/), "user1");
      await userEvent.type(screen.getByLabelText(/表示名/), "テスト");
      await userEvent.type(screen.getByLabelText(/パスワード/), "password123");
      await userEvent.click(screen.getByRole("button", { name: /登録/ }));

      expect(await screen.findByText(/無効/)).toBeInTheDocument();
    });
  });

  describe("ログイン済みアクセス", () => {
    it("ログイン済みで /invite/:token にアクセスするとホーム画面（/）へリダイレクトされる", async () => {
      stubFetch({ isLoggedIn: true, invitationStatus: "active" });
      renderApp("/invite/valid-token");

      await waitFor(() => {
        expect(screen.queryByRole("heading", { name: /ユーザー登録/ })).not.toBeInTheDocument();
      });
    });
  });
});
