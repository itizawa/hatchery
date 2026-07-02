import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InstallSnackbar } from "./InstallSnackbar.js";

// useInstallPrompt をモックして InstallSnackbar を独立テストする
const mockUseInstallPrompt = vi.fn();
vi.mock("../hooks/useInstallPrompt.js", () => ({
  useInstallPrompt: () => mockUseInstallPrompt(),
}));

const defaultContext = {
  isInstallable: true,
  isInstalled: false,
  isIOS: false,
  shouldShowSnackbar: false,
  iosDialogOpen: false,
  notifyScrolledPast: vi.fn(),
  notifyFirstUpvote: vi.fn(),
  dismissSnackbar: vi.fn(),
  promptInstall: vi.fn().mockResolvedValue(undefined),
  openIosInstructions: vi.fn(),
  closeIosInstructions: vi.fn(),
};

describe("InstallSnackbar", () => {
  it("shouldShowSnackbar が false のとき スナックバーが非表示", () => {
    mockUseInstallPrompt.mockReturnValue({ ...defaultContext, shouldShowSnackbar: false });
    render(<InstallSnackbar />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/ホーム画面に追加/)).toBeNull();
  });

  it("shouldShowSnackbar が true のとき スナックバーが表示される", () => {
    mockUseInstallPrompt.mockReturnValue({ ...defaultContext, shouldShowSnackbar: true });
    render(<InstallSnackbar />);
    expect(screen.getByText(/ホーム画面に追加/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "追加する" })).toBeInTheDocument();
  });

  it("「追加する」押下で promptInstall() が呼ばれる（非 iOS）", async () => {
    const promptInstall = vi.fn().mockResolvedValue(undefined);
    mockUseInstallPrompt.mockReturnValue({
      ...defaultContext,
      shouldShowSnackbar: true,
      isIOS: false,
      promptInstall,
    });
    render(<InstallSnackbar />);
    fireEvent.click(screen.getByRole("button", { name: "追加する" }));
    expect(promptInstall).toHaveBeenCalledOnce();
  });

  it("「×」押下で dismissSnackbar() が呼ばれる", () => {
    const dismissSnackbar = vi.fn();
    mockUseInstallPrompt.mockReturnValue({
      ...defaultContext,
      shouldShowSnackbar: true,
      dismissSnackbar,
    });
    render(<InstallSnackbar />);
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(dismissSnackbar).toHaveBeenCalledOnce();
  });

  it("isIOS: true のとき「追加する」押下で openIosInstructions() が呼ばれ promptInstall は呼ばない", () => {
    const promptInstall = vi.fn();
    const openIosInstructions = vi.fn();
    mockUseInstallPrompt.mockReturnValue({
      ...defaultContext,
      shouldShowSnackbar: true,
      isIOS: true,
      promptInstall,
      openIosInstructions,
    });
    render(<InstallSnackbar />);
    fireEvent.click(screen.getByRole("button", { name: "追加する" }));
    expect(openIosInstructions).toHaveBeenCalledOnce();
    expect(promptInstall).not.toHaveBeenCalled();
  });

  it("iosDialogOpen: true のとき iOS 案内 Dialog が表示される", () => {
    mockUseInstallPrompt.mockReturnValue({
      ...defaultContext,
      iosDialogOpen: true,
    });
    render(<InstallSnackbar />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/共有ボタン/)).toBeInTheDocument();
  });

  it("インストール済み（isInstalled: true）で shouldShowSnackbar が false なら非表示", () => {
    mockUseInstallPrompt.mockReturnValue({
      ...defaultContext,
      isInstalled: true,
      shouldShowSnackbar: false,
    });
    render(<InstallSnackbar />);
    expect(screen.queryByText(/ホーム画面に追加/)).toBeNull();
  });
});
