import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse, delay } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { generateCommunityIconUrl } from "@hatchery/common";

import { CommunityBrowseScene } from "./CommunityBrowseScene";
import { QueryBoundary } from "../components/QueryBoundary";
import type { Community } from "../api/communities";
import type React from "react";

const mockCommunities: Community[] = [
  {
    id: "community-1",
    slug: "ai-dev",
    name: "AI 開発者の集い",
    description: "AI ワーカーが日常を語る community",
    synopsis: undefined,
    last_slot_key: undefined,
    created_at: "2026-06-01T00:00:00Z",
    post_count: 5,
    last_post_at: "2026-06-10T09:00:00Z",
    iconUrl: "https://example.com/icon1.png",
  },
  {
    id: "community-2",
    slug: "coding-life",
    name: "コーディング日常",
    description: "コーディングの日常を語る",
    synopsis: undefined,
    last_slot_key: undefined,
    created_at: "2026-06-02T00:00:00Z",
    post_count: 0,
    last_post_at: null,
    iconUrl: null,
  },
];

const server = setupServer(
  http.get("/api/communities", () => HttpResponse.json(mockCommunities)),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string; params?: unknown }) => (
      <a href={to}>{children}</a>
    ),
  };
});

/** QueryBoundary（Suspense + ErrorBoundary）でラップして描画する（#462）。 */
function renderInBoundary(seed?: Community[]) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  if (seed) qc.setQueryData(["communities"], seed);
  return render(
    <QueryClientProvider client={qc}>
      <QueryBoundary fallback={<div>読み込み中スケルトン</div>}>
        <CommunityBrowseScene />
      </QueryBoundary>
    </QueryClientProvider>,
  );
}

describe("CommunityBrowseScene", () => {
  it("カード見出しがコミュニティの表示名で表示される", async () => {
    renderInBoundary(mockCommunities);
    expect(await screen.findByText("AI 開発者の集い")).toBeInTheDocument();
    expect(screen.getByText("コーディング日常")).toBeInTheDocument();
  });

  it("r/ プレフィックス付き slug は表示されない", async () => {
    renderInBoundary(mockCommunities);
    await screen.findByText("AI 開発者の集い");
    expect(screen.queryByText("r/ai-dev")).not.toBeInTheDocument();
    expect(screen.queryByText("r/coding-life")).not.toBeInTheDocument();
  });

  it("ローディング中は Suspense fallback が表示される（#462）", async () => {
    server.use(
      http.get("/api/communities", async () => {
        await delay(50);
        return HttpResponse.json(mockCommunities);
      }),
    );
    renderInBoundary();
    expect(screen.getByText("読み込み中スケルトン")).toBeInTheDocument();
    // 完了後はコミュニティ一覧が表示される
    expect(await screen.findByText("AI 開発者の集い")).toBeInTheDocument();
  });

  it("取得失敗時は ErrorBoundary の再試行フォールバックが表示される（#462）", async () => {
    server.use(
      http.get("/api/communities", () => new HttpResponse(null, { status: 500 })),
    );
    renderInBoundary();
    expect(await screen.findByRole("button", { name: "再試行" })).toBeInTheDocument();
  });

  it("投稿数が表示される（#527）", async () => {
    renderInBoundary(mockCommunities);
    await screen.findByText("AI 開発者の集い");
    expect(screen.getByText("5件の投稿")).toBeInTheDocument();
  });

  it("投稿が 0 件のコミュニティには「投稿なし」が表示される（#527）", async () => {
    renderInBoundary(mockCommunities);
    await screen.findByText("AI 開発者の集い");
    expect(screen.getByText("投稿なし")).toBeInTheDocument();
  });

  it("最終投稿時刻が表示される（#527）", async () => {
    renderInBoundary(mockCommunities);
    await screen.findByText("AI 開発者の集い");
    // last_post_at がある場合は「最終投稿:」ラベルが表示される
    expect(screen.getByText(/最終投稿:/)).toBeInTheDocument();
  });

  it("未投稿のコミュニティには「未投稿」が表示される（#527）", async () => {
    renderInBoundary(mockCommunities);
    await screen.findByText("AI 開発者の集い");
    expect(screen.getByText("未投稿")).toBeInTheDocument();
  });

  it("iconUrl が設定されているコミュニティでは Avatar の src がその URL になる（#1018）", async () => {
    renderInBoundary(mockCommunities);
    await screen.findByText("AI 開発者の集い");
    const img = screen.getByRole("img", { name: "AI 開発者の集い" });
    expect(img).toHaveAttribute("src", "https://example.com/icon1.png");
  });

  it("iconUrl が null のコミュニティでは Avatar の src が bauhaus 自動生成 URL になる（#1018）", async () => {
    renderInBoundary(mockCommunities);
    await screen.findByText("AI 開発者の集い");
    const img = screen.getByRole("img", { name: "コーディング日常" });
    expect(img).toHaveAttribute("src", generateCommunityIconUrl({ id: "community-2" }));
  });

  it("統計行の各項目が単語の途中で改行されないよう white-space: nowrap が設定される（#1116）", async () => {
    renderInBoundary(mockCommunities);
    await screen.findByText("AI 開発者の集い");
    expect(screen.getByText("5件の投稿")).toHaveStyle({ whiteSpace: "nowrap" });
    expect(screen.getByText(/最終投稿:/)).toHaveStyle({ whiteSpace: "nowrap" });
    expect(screen.getByText(/購読者/)).toHaveStyle({ whiteSpace: "nowrap" });
  });
});
