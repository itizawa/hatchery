import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type React from "react";

import { SubscribedCommunitiesSection } from "./SubscribedCommunitiesSection.js";

// RouterLink（ListItemButton の component prop）を <a> に差し替えてルーターコンテキスト依存を排除する。
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  };
});
import { AUTH_ME_QUERY_KEY } from "../api/auth.js";
import { unreadCountsQueryKey } from "../api/subscriptions.js";
import { QueryBoundary } from "./QueryBoundary.js";

const mockUser = {
  id: "user-1",
  name: "テストユーザー",
  email: "test@example.com",
  role: "user" as const,
  imageUrl: null,
  isPremium: false,
};

const mockUnreadCounts = {
  unread_counts: [
    { community_id: "community-1", community_slug: "ai-dev", unread_count: 5 },
    { community_id: "community-2", community_slug: "tech-talk", unread_count: 0 },
    { community_id: "community-3", community_slug: "news", unread_count: 105 },
  ],
};

const mockCommunities = [
  { id: "community-1", slug: "ai-dev", name: "AI 開発", iconUrl: null },
  { id: "community-2", slug: "tech-talk", name: "Tech Talk", iconUrl: null },
  { id: "community-3", slug: "news", name: "ニュース", iconUrl: null },
];

const server = setupServer(
  http.get("/api/communities", () => HttpResponse.json(mockCommunities)),
  http.get("/api/subscriptions/unread-counts", () => HttpResponse.json(mockUnreadCounts)),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderSection({ user = mockUser, seedUnreadCounts = true } = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  qc.setQueryData(AUTH_ME_QUERY_KEY, user);
  if (seedUnreadCounts) {
    qc.setQueryData(unreadCountsQueryKey(), mockUnreadCounts);
  }
  qc.setQueryData(["communities"], mockCommunities);

  return render(
    <QueryClientProvider client={qc}>
      <QueryBoundary fallback={null}>
        <SubscribedCommunitiesSection />
      </QueryBoundary>
    </QueryClientProvider>,
  );
}

function renderSectionNotLoggedIn() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  qc.setQueryData(AUTH_ME_QUERY_KEY, null);

  return render(
    <QueryClientProvider client={qc}>
      <QueryBoundary fallback={null}>
        <SubscribedCommunitiesSection />
      </QueryBoundary>
    </QueryClientProvider>,
  );
}

describe("SubscribedCommunitiesSection", () => {
  it("ログイン済み・未読あり → 購読中セクションが表示される", async () => {
    renderSection();
    expect(await screen.findByText("購読中")).toBeInTheDocument();
  });

  it("ログイン済み・未読あり → バッジに未読数が表示される", async () => {
    renderSection();
    await screen.findByText("購読中");
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("ログイン済み・unread_count 0 → バッジが表示されない", async () => {
    renderSection();
    await screen.findByText("購読中");
    const techTalkItem = screen.getByText("Tech Talk");
    expect(techTalkItem).toBeInTheDocument();
    expect(screen.queryByTestId("unread-badge-community-2")).not.toBeInTheDocument();
  });

  it("unread_count > 99 → '99+' と表示される", async () => {
    renderSection();
    await screen.findByText("購読中");
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("未ログイン → 購読中セクションが表示されない", async () => {
    renderSectionNotLoggedIn();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("購読中")).not.toBeInTheDocument();
  });
});
