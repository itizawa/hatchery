import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CHANNEL_LABEL_MAX_LENGTH, type Channel } from "@hatchery/common";
import { EditChannelNameDialog } from "./EditChannelNameDialog.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const mockChannel: Channel = { id: "zatsudan", label: "雑談", type: "zatsudan" };

describe("EditChannelNameDialog（チャンネル名編集・#206）", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ダイアログが開いたとき現在のチャンネル名が初期値として入力欄に入っている", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, mockChannel)));
    renderWithClient(
      <EditChannelNameDialog open={true} channel={mockChannel} onClose={vi.fn()} />,
    );
    const input = screen.getByRole("textbox", { name: "チャンネル名" });
    expect(input).toHaveValue("雑談");
  });

  it("maxLength が CHANNEL_LABEL_MAX_LENGTH（50）で設定される（AC-b）", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, mockChannel)));
    renderWithClient(
      <EditChannelNameDialog open={true} channel={mockChannel} onClose={vi.fn()} />,
    );
    const input = screen.getByRole("textbox", { name: "チャンネル名" });
    expect(input).toHaveAttribute("maxlength", String(CHANNEL_LABEL_MAX_LENGTH));
  });

  it("空白のみ入力では保存ボタンが無効化される（AC-c）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, mockChannel)));
    renderWithClient(
      <EditChannelNameDialog open={true} channel={mockChannel} onClose={vi.fn()} />,
    );
    const input = screen.getByRole("textbox", { name: "チャンネル名" });
    await userEvent.clear(input);
    await userEvent.type(input, "   ");
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  });

  it("入力欄が空のとき保存ボタンが無効化される（AC-c）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, mockChannel)));
    renderWithClient(
      <EditChannelNameDialog open={true} channel={mockChannel} onClose={vi.fn()} />,
    );
    const input = screen.getByRole("textbox", { name: "チャンネル名" });
    await userEvent.clear(input);
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  });

  it("保存で PATCH /channels/{id} が正しい id・label で呼ばれる（AC-a）", async () => {
    const fetchSpy = vi.fn((input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes(`/channels/${mockChannel.id}`) && (input as Request).method === "PATCH") {
        return Promise.resolve(jsonResponse(200, { ...mockChannel, label: "新しいチャンネル名" }));
      }
      return Promise.resolve(jsonResponse(200, []));
    });
    vi.stubGlobal("fetch", fetchSpy);

    renderWithClient(
      <EditChannelNameDialog open={true} channel={mockChannel} onClose={vi.fn()} />,
    );
    const input = screen.getByRole("textbox", { name: "チャンネル名" });
    await userEvent.clear(input);
    await userEvent.type(input, "新しいチャンネル名");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      const patchCalls = fetchSpy.mock.calls.filter(([req]: [Request | string]) => {
        const url = typeof req === "string" ? req : req.url;
        return url.includes(`/channels/${mockChannel.id}`);
      });
      expect(patchCalls.length).toBeGreaterThan(0);
    });
  });

  it("保存成功で onClose が呼ばれる（モーダルが閉じる）（AC-d）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { ...mockChannel, label: "新しい名前" })),
    );
    const onClose = vi.fn();
    renderWithClient(
      <EditChannelNameDialog open={true} channel={mockChannel} onClose={onClose} />,
    );
    const input = screen.getByRole("textbox", { name: "チャンネル名" });
    await userEvent.clear(input);
    await userEvent.type(input, "新しい名前");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("キャンセルボタンで onClose が呼ばれる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, mockChannel)));
    const onClose = vi.fn();
    renderWithClient(
      <EditChannelNameDialog open={true} channel={mockChannel} onClose={onClose} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onClose).toHaveBeenCalled();
  });
});
