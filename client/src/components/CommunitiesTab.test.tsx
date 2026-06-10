/**
 * CommunitiesTab のテスト（#332）。
 * artifact_config の UI 表示・フォーム操作のテスト。
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Community } from "@hatchery/common";

import { createQueryClient } from "../queryClient.js";
import { CommunitiesTab } from "./CommunitiesTab.js";

const makeCommunity = (overrides: Partial<Community> = {}): Community => ({
  id: "comm-1",
  slug: "test-community",
  name: "テストコミュニティ",
  description: "テスト用コミュニティです。",
  created_at: new Date("2026-06-01T00:00:00Z"),
  artifact_config: null,
  ...overrides,
});

const mockUseCommunities = vi.fn();
const mockUseCreateCommunity = vi.fn();
const mockUseUpdateCommunity = vi.fn();

vi.mock("../api/communities.js", () => ({
  useCommunities: () => mockUseCommunities(),
  useCreateCommunity: () => mockUseCreateCommunity(),
  useUpdateCommunity: () => mockUseUpdateCommunity(),
}));

function renderTab() {
  const queryClient = createQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <CommunitiesTab />
    </QueryClientProvider>,
  );
}

describe("CommunitiesTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCommunities.mockReturnValue({ data: [], isLoading: false });
    mockUseCreateCommunity.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseUpdateCommunity.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  });

  describe("コミュニティ一覧", () => {
    it("コミュニティが存在しないとき「コミュニティがありません」を表示する", () => {
      renderTab();
      expect(screen.getByText("コミュニティがありません。")).toBeInTheDocument();
    });

    it("コミュニティが存在するとき一覧を表示する", () => {
      mockUseCommunities.mockReturnValue({
        data: [makeCommunity({ slug: "tech-news", name: "テックニュース" })],
        isLoading: false,
      });
      renderTab();
      expect(screen.getByText("tech-news")).toBeInTheDocument();
      expect(screen.getByText("テックニュース")).toBeInTheDocument();
    });
  });

  describe("EditCommunityForm — artifact_config (#332)", () => {
    it("artifact_config が null のとき「GitHub Issue 自動起票」チェックボックスが未チェック", async () => {
      const user = userEvent.setup();
      mockUseCommunities.mockReturnValue({
        data: [makeCommunity({ artifact_config: null })],
        isLoading: false,
      });
      renderTab();
      await user.click(screen.getByRole("button", { name: "編集" }));
      const checkbox = screen.getByRole("checkbox", { name: /GitHub Issue 自動起祘/i });
      expect(checkbox).not.toBeChecked();
    });

    it("artifact_config が設定済みのとき「GitHub Issue 自動起祘」チェックボックスがチェック済み", async () => {
      const user = userEvent.setup();
      mockUseCommunities.mockReturnValue({
        data: [
          makeCommunity({
            artifact_config: { skills: ["github-issue"], instructions: "起祘指示" },
          }),
        ],
        isLoading: false,
      });
      renderTab();
      await user.click(screen.getByRole("button", { name: "編集" }));
      const checkbox = screen.getByRole("checkbox", { name: /GitHub Issue 自動起祘/i });
      expect(checkbox).toBeChecked();
    });

    it("チェックボックスをオンにすると instructions フィールドが表示される", async () => {
      const user = userEvent.setup();
      mockUseCommunities.mockReturnValue({
        data: [makeCommunity({ artifact_config: null })],
        isLoading: false,
      });
      renderTab();
      await user.click(screen.getByRole("button", { name: "編集" }));
      const checkbox = screen.getByRole("checkbox", { name: /GitHub Issue 自動起祘/i });
      await user.click(checkbox);
      expect(screen.getByLabelText(/起祘指示文/i)).toBeInTheDocument();
    });
  });
});
