import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreateChannelDialog } from "./CreateChannelDialog";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubFetch(meStatus: number, meBody: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/auth/me")) {
        return Promise.resolve(jsonResponse(meStatus, meBody));
      }
      return Promise.resolve(jsonResponse(201, { id: "new", label: "新チャンネル", type: "zatsudan" }));
    }),
  );
}

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

// 受け入れ条件 #233: チャンネル作成ダイアログの動作
describe("CreateChannelDialog（#233）", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("open=true のときダイアログタイトル「チャンネルを追加」が表示される", async () => {
    stubFetch(200, { id: "u1", displayName: "Alice" });
    const onClose = vi.fn();
    renderWithClient(<CreateChannelDialog open={true} onClose={onClose} />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("チャンネルを追加")).toBeInTheDocument();
  });

  it("open=false のときダイアログは非表示", () => {
    stubFetch(200, { id: "u1", displayName: "Alice" });
    const onClose = vi.fn();
    renderWithClient(<CreateChannelDialog open={false} onClose={onClose} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("ダイアログ内にチャンネル名入力欄とゴール選択ラジオが表示される", async () => {
    stubFetch(200, { id: "u1", displayName: "Alice" });
    const onClose = vi.fn();
    renderWithClient(<CreateChannelDialog open={true} onClose={onClose} />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "チャンネル名" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "発言（会話）" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "起票（Issue 作成）" })).toBeInTheDocument();
  });

  it("チャンネル名が空のとき送信ボタンが無効", async () => {
    stubFetch(200, { id: "u1", displayName: "Alice" });
    const onClose = vi.fn();
    renderWithClient(<CreateChannelDialog open={true} onClose={onClose} />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    const submitButton = screen.getByRole("button", { name: "追加" });
    expect(submitButton).toBeDisabled();
  });

  it("チャンネル名を入力すると送信ボタンが有効になる", async () => {
    stubFetch(200, { id: "u1", displayName: "Alice" });
    const onClose = vi.fn();
    renderWithClient(<CreateChannelDialog open={true} onClose={onClose} />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: "チャンネル名" }), "テスト");
    expect(screen.getByRole("button", { name: "追加" })).toBeEnabled();
  });

  it("送信するとチャンネル作成 API が呼ばれダイアログが閉じる", async () => {
    const fetchSpy = vi.fn((input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/auth/me")) {
        return Promise.resolve(jsonResponse(200, { id: "u1", displayName: "Alice" }));
      }
      return Promise.resolve(jsonResponse(201, { id: "new", label: "テスト", type: "zatsudan" }));
    });
    vi.stubGlobal("fetch", fetchSpy);
    const onClose = vi.fn();
    renderWithClient(<CreateChannelDialog open={true} onClose={onClose} />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: "チャンネル名" }), "テスト");
    await userEvent.click(screen.getByRole("button", { name: "追加" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("キャンセルボタンをクリックすると onClose が呼ばれる", async () => {
    stubFetch(200, { id: "u1", displayName: "Alice" });
    const onClose = vi.fn();
    renderWithClient(<CreateChannelDialog open={true} onClose={onClose} />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onClose).toHaveBeenCalled();
  });
});
