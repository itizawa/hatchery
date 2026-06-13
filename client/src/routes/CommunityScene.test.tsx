import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse, delay } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { CommunityScene } from "./CommunityScene";
import {
  communityFeedQueryKey,
  communityRecentWorkersQueryKey,
  communitySubscriptionQueryKey,
} from "../api/communities";
import { AUTH_ME_QUERY_KEY } from "../api/auth";
import { QueryBoundary } from "../components/QueryBoundary";
import { MainContentSkeleton } from "../components/MainContentSkeleton";
import type { Community, RecentWorker } from "../api/communities";
import type React from "react";

const mockCommunity: Community = {
  id: "community-1",
  slug: "ai-dev",
  name: "AI 開発者の集い",
  description: "AI ワーカーが日常を語る community",
  synopsis: undefined,
  last_slot_key: undefined,
  created_at: "2026-06-01T00:00:00Z",
};

const mockRecentWorkers: RecentWorker[] = [
  { id: "worker-1", displayName: "haru", role: "ムードメーカー", imageUrl: null },
];

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useParams: () => ({ slug: "ai-dev" }),
    Link: ({ children, to }: { children: React.ReactNode; to: string; params?: unknown }) => (
      <a href={to}>{children}</a>
    ),
  };
});

const server = setupServer(
  http.get("/api/communities", () => HttpResponse.json([mockCommunity])),
  http.get("/api/communities/:slug/feed", () => HttpResponse.json([])),
  http.get("/api/communities/:slug/recent-workers", () => HttpResponse.json(mockRecentWorkers)),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * #462: CommunityScene を router と同じく QueryBoundary でラップして描画する。
 * recent-workers 以外（communities/feed/subscription/auth）はキャッシュにシードしておき、
 * recent-workers の挙動（成功/ローディング/失敗）を MSW で個別に検証できるようにする。
 */
function renderScene({ seedRecentWorkers = true }: { seedRecentWorkers?: boolean } = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  qc.setQueryData(["communities"], [mockCommunity]);
  qc.setQueryData(communityFeedQueryKey("ai-dev"), []);
  qc.setQueryData(communitySubscriptionQueryKey("ai-dev"), { subscribed: false });
  qc.setQueryData(AUTH_ME_QUERY_KEY, null);
  if (seedRecentWorkers) {
    qc.setQueryData(communityRecentWorkersQueryKey("ai-dev"), mockRecentWorkers);
  }

  return render(
    <QueryClientProvider client={qc}>
      <QueryBoundary fallback={<MainContentSkeleton />}>
        <CommunityScene />
      </QueryBoundary>
    </QueryClientProvider>,
  );
}

describe("CommunityScene", () => {
  it("h1 にコミュニティの表示名が表示される", async () => {
    renderScene();
    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("AI 開発者の集い");
  });

  it("r/ プレフィックス付き slug は表示されない", async () => {
    renderScene();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText("r/ai-dev")).not.toBeInTheDocument();
  });

  it("コミュニティの説明が表示される", async () => {
    renderScene();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getAllByText("AI ワーカーが日常を語る community").length).toBeGreaterThan(0);
  });

  it("サイドバーに作成日が「YYYY年M月D日 作成」フォーマットで表示される", async () => {
    renderScene();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByText("2026年6月1日 作成")).toBeInTheDocument();
  });

  it("サイドバーに最近投稿したワーカーが表示される（#207 / #462）", async () => {
    renderScene();
    expect(await screen.findByText("haru")).toBeInTheDocument();
    expect(screen.getByText("ムードメーカー")).toBeInTheDocument();
  });

  it("最近投稿したワーカー取得中はサイドバーに局所ローディングが表示される（#462）", async () => {
    server.use(
      http.get("/api/communities/:slug/recent-workers", async () => {
        await delay(50);
        return HttpResponse.json(mockRecentWorkers);
      }),
    );
    renderScene({ seedRecentWorkers: false });
    // 本体（見出し）は表示され、ワーカーパネルだけ「読み込み中...」になる
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
    // 完了後にワーカーが表示される
    expect(await screen.findByText("haru")).toBeInTheDocument();
  });

  it("最近投稿したワーカー取得に失敗するとサイドバーに失敗メッセージが表示される（#462）", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(
      http.get(
        "/api/communities/:slug/recent-workers",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    renderScene({ seedRecentWorkers: false });
    expect(await screen.findByText("読み込みに失敗しました")).toBeInTheDocument();
    // 本体（見出し）は表示され続ける
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    errorSpy.mockRestore();
  });
});
