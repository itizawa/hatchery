import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "../queryClient.js";
import { createAppRouter } from "../router.js";

function makeLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    // eslint-disable-next-line max-params
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() { return Object.keys(store).length; },
  };
}

// eslint-disable-next-line max-params
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
      if (url.includes("/auth/logout")) {
        return Promise.resolve(jsonResponse(200));
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
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...utils, router };
}

describe("AppHeader", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // #932: vi.unstubAllGlobals() で localStorage が undefined になる場合があるため stub で確保する。
    const lsMock = makeLocalStorageMock();
    lsMock.setItem("hatchery_visited", "true");
    vi.stubGlobal("localStorage", lsMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ログイン済みのとき displayName（名前テキスト）が表示されない", async () => {
    stubFetch(true);
    renderApp("/");

    await screen.findByRole("button", { name: /ユーザーメニュー/ });
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  });

  it("認証確認中（isPending）に Skeleton が表示される", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise(() => {})));
    renderApp("/channels/test-channel");

    expect(await screen.findByTestId("account-skeleton")).toBeInTheDocument();
  });

  it("初期表示時にアカウント設定が DOM 上に存在しない（Menu は闆じている）", async () => {
    stubFetch(true);
    renderApp("/");

    await screen.findByRole("button", { name: /ユーザーメニュー/ });

    expect(screen.queryByRole("menuitem", { name: /アカウント設定/ })).not.toBeInTheDocument();
  });

  it("初期表示時にログアウト menuitem が DOM 上に存在しない（Menu は闆じている）", async () => {
    stubFetch(true);
    renderApp("/");

    await screen.findByRole("button", { name: /ユーザーメニュー/ });

    expect(screen.queryByRole("menuitem", { name: /ログアウト/ })).not.toBeInTheDocument();
  });

  it("ユーザーメニュートリガーボタンが表示される", async () => {
    stubFetch(true);
    renderApp("/");

    expect(await screen.findByRole("button", { name: /ユーザーメニュー/ })).toBeInTheDocument();
  });

  it("トリガークリック後にアカウント設定 menuitem が表示される", async () => {
    stubFetch(true);
    renderApp("/");

    const trigger = await screen.findByRole("button", { name: /ユーザーメニュー/ });
    await userEvent.click(trigger);

    expect(await screen.findByRole("menuitem", { name: /アカウント設定/ })).toBeInTheDocument();
  });

  it("トリガークリック後にログアウト menuitem が表示される", async () => {
    stubFetch(true);
    renderApp("/");

    const trigger = await screen.findByRole("button", { name: /ユーザーメニュー/ });
    await userEvent.click(trigger);

    expect(await screen.findByRole("menuitem", { name: /ログアウト/ })).toBeInTheDocument();
  });

  it("ログアウト menuitem クリックで /auth/logout への POST リクエストが送信される", async () => {
    stubFetch(true);
    renderApp("/");

    const trigger = await screen.findByRole("button", { name: /ユーザーメニュー/ });
    await userEvent.click(trigger);

    const logoutItem = await screen.findByRole("menuitem", { name: /ログアウト/ });
    await userEvent.click(logoutItem);

    const fetchMock = vi.mocked(global.fetch);
    await waitFor(() => {
      const logoutCalls = fetchMock.mock.calls.filter(([input]) => {
        const url = input instanceof Request ? input.url : String(input);
        return url.includes("/auth/logout");
      });
      expect(logoutCalls.length).toBeGreaterThan(0);
    });
  });

  // #454: ログアウト後はゲスト向け公開ホームへ戻り、ログインモーダルは自動では開かない（ヘッダーにログイン導線が出る）。
  it("ログアウト成功後にゲスト表示（ヘッダーのログインリンク）に切り替わる", async () => {
    // ログアウト後の再フェッチで未ログイン（401）になるよう、呼び出しで状態を切り替える。
    let loggedIn = true;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url.includes("/auth/logout")) {
          loggedIn = false;
          return Promise.resolve(jsonResponse(200));
        }
        if (url.includes("/auth/me")) {
          return Promise.resolve(
            loggedIn ? jsonResponse(200, { id: "user1", displayName: "Alice" }) : jsonResponse(401),
          );
        }
        if (url.includes("/api/feed")) {
          return Promise.resolve(jsonResponse(200, { posts: [], nextCursor: null }));
        }
        return Promise.resolve(jsonResponse(200, []));
      }),
    );
    renderApp("/");

    const trigger = await screen.findByRole("button", { name: /ユーザーメニュー/ });
    await userEvent.click(trigger);

    const logoutItem = await screen.findByRole("menuitem", { name: /ログアウト/ });
    await userEvent.click(logoutItem);

    // ログインモーダル（heading "ログイン"）は開かず、ヘッダーのログインリンクが表示される。
    expect(await screen.findByRole("link", { name: /ログイン/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^ログイン$/ })).not.toBeInTheDocument();
  });

  // #454: ヘッダーのログインリンクをクリックすると、ページ遷移せずログインモーダルが開く（背景が保持される）。
  it("ログインリンクをクリックするとログインモーダルが開き、背景のコンテンツが保持される", async () => {
    stubFetch(false);
    renderApp("/");

    // 背景にホームフィードが描画されていることを確認（モーダルを開く前は role でも見つかる）。
    await screen.findByRole("heading", { name: /ホームフィード/ });
    const loginLink = await screen.findByRole("link", { name: /ログイン/ });
    await userEvent.click(loginLink);

    // モーダル（Google でログイン）が開く。
    expect(await screen.findByRole("button", { name: /Google でログイン/ })).toBeInTheDocument();
    // 背景のホームフィードは DOM 上に残ったまま（ページ遷移していない）。
    // モーダル展開後は背景が aria-hidden になるため role ではなく text で存在を確認する。
    expect(screen.getByText("ホームフィード")).toBeInTheDocument();
  });

  it("未ログイン時は displayName が表示されない", async () => {
    stubFetch(false);
    renderApp("/");

    await waitFor(() => {
      expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    });
  });

  it("未ログイン時はユーザーメニュートリガーが表示されない", async () => {
    stubFetch(false);
    renderApp("/");

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /ユーザーメニュー/ })).not.toBeInTheDocument();
    });
  });

  it("Hatchery ブランド名がヘッダーに表示される", async () => {
    stubFetch(true);
    renderApp("/");

    expect(await screen.findByRole("link", { name: /Hatchery/ })).toBeInTheDocument();
  });

  // Issue #255: 未認証ユーザーへのログイン誘導 UI
  it("未ログイン時にヘッダーにログインリンクが表示される", async () => {
    stubFetch(false);
    renderApp("/channels/zatsudan");

    expect(await screen.findByRole("link", { name: /ログイン/ })).toBeInTheDocument();
  });

  it("ログイン済み時にヘッダーにログインリンクが表示されない", async () => {
    stubFetch(true);
    renderApp("/");

    await screen.findByRole("button", { name: /ユーザーメニュー/ });
    expect(screen.queryByRole("link", { name: /ログイン/ })).not.toBeInTheDocument();
  });

  // Issue #485: ヘッダー高さの一定化・区切りの borderBottom 化
  describe("ヘッダーの高さ一定化と区切り（#485）", () => {
    const EXPECTED_SLOT_HEIGHT = "40px";

    it("ログイン時：右端スロットが固定高さ 40px を持つ", async () => {
      stubFetch(true);
      renderApp("/");

      await screen.findByRole("button", { name: /ユーザーメニュー/ });
      const slot = screen.getByTestId("header-right-slot");
      expect(slot).toHaveStyle({ height: EXPECTED_SLOT_HEIGHT });
    });

    it("未ログイン時：右端スロットが固定高さ 40px を持つ（ログイン時と同一）", async () => {
      stubFetch(false);
      renderApp("/channels/zatsudan");

      await screen.findByRole("link", { name: /ログイン/ });
      const slot = screen.getByTestId("header-right-slot");
      expect(slot).toHaveStyle({ height: EXPECTED_SLOT_HEIGHT });
    });

    it("認証ローディング時：右端スロットが固定高さ 40px を持つ（他状態と同一）", async () => {
      vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise(() => {})));
      renderApp("/channels/test-channel");

      await screen.findByTestId("account-skeleton");
      const slot = screen.getByTestId("header-right-slot");
      expect(slot).toHaveStyle({ height: EXPECTED_SLOT_HEIGHT });
    });

    it("ヘッダー本文との区切りが薄い borderBottom（divider）で表現される", async () => {
      stubFetch(true);
      renderApp("/");

      await screen.findByRole("button", { name: /ユーザーメニュー/ });
      const header = screen.getByTestId("app-header");
      expect(header).toHaveStyle({ borderBottomStyle: "solid" });
      expect(header).toHaveStyle({ borderBottomWidth: "1px" });
    });

    it("ヘッダーの区切りに boxShadow を使わない", async () => {
      stubFetch(true);
      renderApp("/");

      await screen.findByRole("button", { name: /ユーザーメニュー/ });
      const header = screen.getByTestId("app-header");
      const boxShadow = window.getComputedStyle(header).boxShadow;
      expect(boxShadow === "" || boxShadow === "none").toBe(true);
    });
  });

  // Issue #1055: ヘッダー上で検索文字を常に入力できるようにする
  describe("ヘッダー検索欄（#1055）", () => {
    it("検索アイコン付きの入力欄が常に表示される", async () => {
      stubFetch(true);
      renderApp("/");

      expect(await screen.findByRole("searchbox", { name: /投稿を検索/ })).toBeInTheDocument();
    });

    it("キーワードを入力して Enter を押すと検索結果ページへ遷移する", async () => {
      stubFetch(true);
      renderApp("/");

      const input = await screen.findByRole("searchbox", { name: /投稿を検索/ });
      await userEvent.type(input, "テスト{Enter}");

      expect(
        await screen.findByText("「テスト」に一致する投稿が見つかりませんでした。"),
      ).toBeInTheDocument();
    });

    it("何も入力せず Enter を押すと /search の案内テキストが表示される", async () => {
      stubFetch(true);
      renderApp("/");

      const input = await screen.findByRole("searchbox", { name: /投稿を検索/ });
      await userEvent.click(input);
      await userEvent.keyboard("{Enter}");

      expect(
        await screen.findByText("キーワードを入力して投稿を検索できます。"),
      ).toBeInTheDocument();
    });

    it("/search?q=foo を開いた状態でヘッダー検索欄の初期値が foo になっている", async () => {
      stubFetch(true);
      renderApp("/search?q=foo");

      const input = await screen.findByRole<HTMLInputElement>("searchbox", { name: /投稿を検索/ });
      expect(input.value).toBe("foo");
    });

    // 未送信の編集中に別ページへ遷移しても、ヘッダーは常設（アンマウントされない）ため
    // ルートの q 変化に追従する effect が誤って上書きしないことを確認する。
    it("未送信の編集中に別ページへ遷移しても入力中のテキストが保持される", async () => {
      stubFetch(true);
      renderApp("/search?q=foo");

      const input = await screen.findByRole<HTMLInputElement>("searchbox", { name: /投稿を検索/ });
      await userEvent.clear(input);
      await userEvent.type(input, "foobar");
      expect(input.value).toBe("foobar");

      const homeLink = await screen.findByRole("link", { name: /ホーム/ });
      await userEvent.click(homeLink);

      await screen.findByRole("heading", { name: /ホームフィード/ });
      expect(input.value).toBe("foobar");
    });

    // @tanstack/react-form の isDirty は一度編集すると reset() するまで true のまま残る
    // 「一度きりのフラグ」であり、これをそのまま追従判定に使うと、入力を打ち消して既定値に
    // 戻した後も「編集中」とみなされ続け、以後 q が変わっても二度と追従しなくなってしまう。
    // ライブなフィールド値比較で判定していることを確認する。
    it("入力を打ち消して既定値へ戻した後は、別ページ経由の q 変化に追従して更新される", async () => {
      stubFetch(true);
      const { router } = renderApp("/");

      const input = await screen.findByRole<HTMLInputElement>("searchbox", { name: /投稿を検索/ });
      await userEvent.type(input, "cats");
      await userEvent.clear(input);
      expect(input.value).toBe("");

      await router.navigate({ to: "/search", search: { q: "cats" } });

      await waitFor(() => {
        expect(input.value).toBe("cats");
      });
    });

    // `/search` 以外のルートは validateSearch を持たず未知の search param を素通りさせるため、
    // 偶然 URL に `q` が含まれていてもヘッダー検索欄には無関係な文字列を出さないことを確認する。
    it("/search 以外のページの URL に q が含まれていてもヘッダー検索欄には反映されない", async () => {
      stubFetch(true);
      renderApp("/ranking?q=leftover");

      const input = await screen.findByRole<HTMLInputElement>("searchbox", { name: /投稿を検索/ });
      expect(input.value).toBe("");
    });
  });
});
