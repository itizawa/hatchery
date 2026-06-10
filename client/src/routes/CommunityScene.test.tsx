import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CommunityScene } from "./CommunityScene";
import { communityFeedQueryKey, communitySubscriptionQueryKey } from "../api/communities";
import { AUTH_ME_QUERY_KEY } from "../api/auth";
import type { Community } from "../api/communities";
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

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  qc.setQueryData(["communities"], [mockCommunity]);
  qc.setQueryData(communityFeedQueryKey("ai-dev"), []);
  qc.setQueryData(communitySubscriptionQueryKey("ai-dev"), { subscribed: false });
  qc.setQueryData(AUTH_ME_QUERY_KEY, null);

  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("CommunityScene", () => {
  it("h1 にコミュニティの表示名が表示される", async () => {
    render(<CommunityScene />, { wrapper: Wrapper });
    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("AI 開発者の集い");
  });

  it("r/ プレフィックス付き slug は表示されない", async () => {
    render(<CommunityScene />, { wrapper: Wrapper });
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText("r/ai-dev")).not.toBeInTheDocument();
  });

  it("コミュニティの説明が表示される", async () => {
    render(<CommunityScene />, { wrapper: Wrapper });
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getAllByText("AI ワーカーが日常を語る community").length).toBeGreaterThan(0);
  });

  it("サイドバーに作成日が「YYYY年M月D日 作成」フォーマットで表示される", async () => {
    render(<CommunityScene />, { wrapper: Wrapper });
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByText("2026年6月1日 作成")).toBeInTheDocument();
  });
});
