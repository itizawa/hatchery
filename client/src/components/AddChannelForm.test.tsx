import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AddChannelForm } from "./AddChannelForm";

// 静的 userEvent API を使う（@testing-library/user-event v14 の setup() は jsdom との互換問題があるため）

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** URL に応じて応答を切り替える fetch スタブ */
function stubFetch(meStatus: number, meBody: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/auth/me")) {
        return Promise.resolve(jsonResponse(meStatus, meBody));
      }
      return Promise.resolve(jsonResponse(201, { id: "new", label: "#新規", type: "zatsudan" }));
    }),
  );
}

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("AddChannelForm（アイコンボタン＋モーダル・#177）", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("未ログイン（401）のときは何も表示しない", async () => {
    const fetchSpy = vi.fn((input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      return Promise.resolve(jsonResponse(url.includes("/auth/me") ? 401 : 201, { error: "x" }));
    });
    vi.stubGlobal("fetch", fetchSpy);
    const { container } = renderWithClient(<AddChannelForm />);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("ログイン時はアイコンボタンを表示する（aria-label='チャンネル作成'）", async () => {
    stubFetch(200, { id: "u1", displayName: "Alice" });
    renderWithClient(<AddChannelForm />);
    expect(await screen.findByRole("button", { name: "チャンネル作成" })).toBeInTheDocument();
  });

  it("ログイン時はフォームを常時表示しない（初期状態でダイアログが閉じている）", async () => {
    stubFetch(200, { id: "u1", displayName: "Alice" });
    renderWithClient(<AddChannelForm />);
    await screen.findByRole("button", { name: "チャンネル作成" });
    expect(screen.queryByRole("button", { name: "追加" })).not.toBeInTheDocument();
  });

  it("アイコンボタンをクリックするとダイアログが開く", async () => {
    stubFetch(200, { id: "u1", displayName: "Alice" });
    renderWithClient(<AddChannelForm />);
    await userEvent.click(await screen.findByRole("button", { name: "チャンネル作成" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "追加" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "チャンネル名" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "雑談" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "仕事" })).toBeInTheDocument();
  });

  it("キャンセルボタンでダイアログが閉じ mutation は走らない", async () => {
    const fetchSpy = vi.fn((input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/auth/me")) return Promise.resolve(jsonResponse(200, { id: "u1", displayName: "Alice" }));
      return Promise.resolve(jsonResponse(201, { id: "new", label: "#新規", type: "zatsudan" }));
    });
    vi.stubGlobal("fetch", fetchSpy);
    renderWithClient(<AddChannelForm />);
    await userEvent.click(await screen.findByRole("button", { name: "チャンネル作成" }));
    await screen.findByRole("dialog");
    await userEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const postCalls = fetchSpy.mock.calls.filter(([input]: [Request | string]) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      return url.includes("/channels");
    });
    expect(postCalls).toHaveLength(0);
  });

  it("フォーム送信で mutation が走り成功後にダイアログが閉じる", async () => {
    stubFetch(200, { id: "u1", displayName: "Alice" });
    renderWithClient(<AddChannelForm />);
    await userEvent.click(await screen.findByRole("button", { name: "チャンネル作成" }));
    await screen.findByRole("dialog");
    await userEvent.type(screen.getByRole("textbox", { name: "チャンネル名" }), "テストチャンネル");
    await userEvent.click(screen.getByRole("button", { name: "追加" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
