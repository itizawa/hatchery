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

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/auth/me")) {
        return Promise.resolve(jsonResponse(401));
      }
      if (url.includes("/api/posts/search")) {
        return Promise.resolve(jsonResponse(200, []));
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

describe("SearchScene", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    const lsMock = makeLocalStorageMock();
    lsMock.setItem("hatchery_visited", "true");
    vi.stubGlobal("localStorage", lsMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // #1055 のセルフレビューで検出: ページ本体の検索欄は表示中の検索結果と常に一致させる必要が
  // あるため、未送信の編集があっても q の変化（search param のみの遷移。TanStack Router は
  // この種の遷移でコンポーネントを再マウントしない）に追従してリセットされることを確認する。
  it("未送信の編集中に q が変わる（戻る/進む相当）と、入力欄が新しい q に追従してリセットされる", async () => {
    stubFetch();
    const { router } = renderApp("/search?q=dogs");

    const input = await screen.findByPlaceholderText<HTMLInputElement>("キーワードを入力...");
    expect(input.value).toBe("dogs");

    await userEvent.clear(input);
    await userEvent.type(input, "dogs2");
    expect(input.value).toBe("dogs2");

    await router.navigate({ to: "/search", search: { q: "cats" } });

    await waitFor(() => {
      expect(input.value).toBe("cats");
    });
  });
});
