import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
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

function stubFetch(searchResults: unknown[] = []) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/auth/me")) {
        return Promise.resolve(jsonResponse(401));
      }
      if (url.includes("/api/posts/search")) {
        return Promise.resolve(jsonResponse(200, searchResults));
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

  // Issue #1112: ヘッダー検索欄の常設に伴い、ページ本体の重複する見出し・検索フォームを削除した。
  it("見出し「投稿を検索」が表示されない", async () => {
    stubFetch();
    renderApp("/search?q=dogs");

    await screen.findByText("「dogs」に一致する投稿が見つかりませんでした。");
    expect(screen.queryByRole("heading", { name: "投稿を検索" })).not.toBeInTheDocument();
  });

  it("ページ内検索フォーム（プレースホルダー「キーワードを入力...」）が表示されない", async () => {
    stubFetch();
    renderApp("/search?q=dogs");

    await screen.findByText("「dogs」に一致する投稿が見つかりませんでした。");
    expect(screen.queryByPlaceholderText("キーワードを入力...")).not.toBeInTheDocument();
  });

  it("my_vote: 'up' の投稿は検索結果一覧で up vote 済み表示になる（#1059）", async () => {
    stubFetch([
      {
        id: "post-1",
        community_id: "community-1",
        slot_key: "2024-01-01",
        seq: 1,
        author: "worker-1",
        title: "投票済みの投稿",
        text: "本文",
        score: 1,
        created_at: "2024-01-01T00:00:00Z",
        comment_count: 0,
        my_vote: "up",
      },
    ]);
    renderApp("/search?q=dogs");

    const upVoteButton = await screen.findByRole("button", { name: "up vote" });
    expect(upVoteButton).toHaveAttribute("aria-pressed", "true");
  });
});
