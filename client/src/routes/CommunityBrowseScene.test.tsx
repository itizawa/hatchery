import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CommunityBrowseScene } from "./CommunityBrowseScene";
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
  },
  {
    id: "community-2",
    slug: "coding-life",
    name: "コーディング日常",
    description: "コーディングの日常を語る",
    synopsis: undefined,
    last_slot_key: undefined,
    created_at: "2026-06-02T00:00:00Z",
  },
];

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  qc.setQueryData(["communities"], mockCommunities);

  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string; params?: unknown }) => (
      <a href={to}>{children}</a>
    ),
  };
});

describe("CommunityBrowseScene", () => {
  it("カード見出しがコミュニティの表示名で表示される", async () => {
    render(<CommunityBrowseScene />, { wrapper: Wrapper });
    expect(await screen.findByText("AI 開発者の集い")).toBeInTheDocument();
    expect(screen.getByText("コーディング日常")).toBeInTheDocument();
  });

  it("r/ プレフィックス付き slug は表示されない", async () => {
    render(<CommunityBrowseScene />, { wrapper: Wrapper });
    await screen.findByText("AI 開発者の集い");
    expect(screen.queryByText("r/ai-dev")).not.toBeInTheDocument();
    expect(screen.queryByText("r/coding-life")).not.toBeInTheDocument();
  });
});
