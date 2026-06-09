import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Invitation } from "@hatchery/common";

import { createQueryClient } from "../queryClient.js";
import { InvitationsTab } from "./InvitationsTab.js";

const makeInvitation = (overrides: Partial<Invitation> = {}): Invitation => ({
  id: "inv-1",
  token: "tok-abc123",
  expiresAt: new Date("2030-12-31T00:00:00Z"),
  status: "active",
  memo: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  usedAt: null,
  ...overrides,
});

const mockUseInvitations = vi.fn();
const mockUseCreateInvitation = vi.fn();
const mockUseRevokeInvitation = vi.fn();

vi.mock("../api/invitations.js", () => ({
  useInvitations: () => mockUseInvitations(),
  useCreateInvitation: () => mockUseCreateInvitation(),
  useRevokeInvitation: () => mockUseRevokeInvitation(),
}));

function renderTab() {
  const queryClient = createQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <InvitationsTab />
    </QueryClientProvider>,
  );
}

describe("InvitationsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseInvitations.mockReturnValue({ data: [], isLoading: false });
    mockUseCreateInvitation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseRevokeInvitation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  });

  describe("招待一覧テーブル", () => {
    it("active 招待を表示し、ステータス Chip が「有効」", async () => {
      mockUseInvitations.mockReturnValue({ data: [makeInvitation({ status: "active" })], isLoading: false });
      renderTab();
      expect(await screen.findByText("有効")).toBeInTheDocument();
    });

    it("used 招待のステータス Chip が「使用済み」", async () => {
      mockUseInvitations.mockReturnValue({
        data: [makeInvitation({ status: "used", usedAt: new Date() })],
        isLoading: false,
      });
      renderTab();
      expect(await screen.findByText("使用済み")).toBeInTheDocument();
    });

    it("expired 招待のステータス Chip が「期限切れ」", async () => {
      mockUseInvitations.mockReturnValue({
        data: [makeInvitation({ status: "expired", expiresAt: new Date("2020-01-01") })],
        isLoading: false,
      });
      renderTab();
      expect(await screen.findByText("期限切れ")).toBeInTheDocument();
    });

    it("revoked 招待のステータス Chip が「失効済み」", async () => {
      mockUseInvitations.mockReturnValue({
        data: [makeInvitation({ status: "revoked" })],
        isLoading: false,
      });
      renderTab();
      expect(await screen.findByText("失効済み")).toBeInTheDocument();
    });

    it("active 招待の「失効」ボタンは活性", async () => {
      mockUseInvitations.mockReturnValue({ data: [makeInvitation({ status: "active" })], isLoading: false });
      renderTab();
      const revokeBtn = await screen.findByRole("button", { name: "失効" });
      expect(revokeBtn).not.toBeDisabled();
    });

    it("active 以外の招待の「失効」ボタンは非活性", async () => {
      mockUseInvitations.mockReturnValue({
        data: [makeInvitation({ status: "used", usedAt: new Date() })],
        isLoading: false,
      });
      renderTab();
      const revokeBtn = await screen.findByRole("button", { name: "失効" });
      expect(revokeBtn).toBeDisabled();
    });

    it("「失効」ボタン押下で revokeInvitation が呼ばれる", async () => {
      const revokeMock = vi.fn().mockResolvedValue(makeInvitation({ status: "revoked" }));
      mockUseRevokeInvitation.mockReturnValue({ mutateAsync: revokeMock, isPending: false });
      mockUseInvitations.mockReturnValue({ data: [makeInvitation({ status: "active" })], isLoading: false });
      renderTab();

      await userEvent.click(await screen.findByRole("button", { name: "失効" }));
      expect(revokeMock).toHaveBeenCalledWith("inv-1");
    });

    it("テーブルに URL コピーボタンが表示される", async () => {
      mockUseInvitations.mockReturnValue({ data: [makeInvitation({ status: "active" })], isLoading: false });
      renderTab();
      expect(await screen.findByRole("button", { name: /URL コピー/ })).toBeInTheDocument();
    });

    it("URL コピーボタン押下で navigator.clipboard.writeText が呼ばれる", async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: writeTextMock },
        writable: true,
        configurable: true,
      });
      mockUseInvitations.mockReturnValue({ data: [makeInvitation({ token: "tok-abc123", status: "active" })], isLoading: false });
      renderTab();

      await userEvent.click(await screen.findByRole("button", { name: /URL コピー/ }));
      expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining("tok-abc123"));
    });
  });

  describe("isLoading 状態（#241）", () => {
    it("isLoading=true のときスケルトン要素が表示される", async () => {
      mockUseInvitations.mockReturnValue({ data: [], isLoading: true });
      renderTab();
      expect(await screen.findAllByTestId("invitations-skeleton-item")).toBeTruthy();
    });

    it("isLoading=true のとき「読み込み中...」テキストは表示されない", () => {
      mockUseInvitations.mockReturnValue({ data: [], isLoading: true });
      renderTab();
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
    });
  });

  describe("招待発行フォーム", () => {
    it("有効期限の選択肢が表示される", async () => {
      renderTab();
      expect(await screen.findByLabelText(/有効期限/)).toBeInTheDocument();
    });

    it("メモ入力フィールドに maxLength 制約がある", async () => {
      renderTab();
      const memoInput = await screen.findByLabelText(/メモ/);
      expect(memoInput).toHaveAttribute("maxlength", "200");
    });

    it("「発行」ボタン押下で createInvitation が呼ばれる", async () => {
      const createMock = vi.fn().mockResolvedValue(makeInvitation());
      mockUseCreateInvitation.mockReturnValue({ mutateAsync: createMock, isPending: false });
      renderTab();

      await userEvent.click(await screen.findByRole("button", { name: "発行" }));
      await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    });

    it("発行後に招待 URL が表示される", async () => {
      const newInvitation = makeInvitation({ token: "new-token-xyz" });
      const createMock = vi.fn().mockResolvedValue(newInvitation);
      mockUseCreateInvitation.mockReturnValue({ mutateAsync: createMock, isPending: false });
      renderTab();

      await userEvent.click(await screen.findByRole("button", { name: "発行" }));
      await waitFor(() => expect(screen.getByText(/new-token-xyz/)).toBeInTheDocument());
    });

    it("発行後の URL コピーボタン押下で navigator.clipboard.writeText が呼ばれる", async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: writeTextMock },
        writable: true,
        configurable: true,
      });
      const newInvitation = makeInvitation({ token: "new-token-xyz" });
      const createMock = vi.fn().mockResolvedValue(newInvitation);
      mockUseCreateInvitation.mockReturnValue({ mutateAsync: createMock, isPending: false });
      renderTab();

      await userEvent.click(await screen.findByRole("button", { name: "発行" }));
      await screen.findByText(/new-token-xyz/);

      const copyButtons = screen.getAllByRole("button", { name: /コピー/ });
      await userEvent.click(copyButtons[copyButtons.length - 1]);
      expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining("new-token-xyz"));
    });
  });
});
