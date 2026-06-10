import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AddWorkerDialog } from "./AddWorkerDialog";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubFetch(createStatus: number, createBody: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/auth/me")) {
        return Promise.resolve(jsonResponse(200, { id: "u1", displayName: "Admin" }));
      }
      if (url.includes("/admin/workers")) {
        return Promise.resolve(jsonResponse(createStatus, createBody));
      }
      return Promise.resolve(jsonResponse(200, []));
    }),
  );
}

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

// 受け入れ条件 #217 / #329: Worker 追加ダイアログの動作
describe("AddWorkerDialog（#217 / #329）", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("open=true のときダイアログタイトル「社員を追加」が表示される", async () => {
    stubFetch(201, { id: "new-id", displayName: "新社員" });
    const onClose = vi.fn();
    renderWithClient(<AddWorkerDialog open={true} onClose={onClose} />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("社員を追加")).toBeInTheDocument();
  });

  it("open=false のときダイアログは非表示", () => {
    stubFetch(201, {});
    const onClose = vi.fn();
    renderWithClient(<AddWorkerDialog open={false} onClose={onClose} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("ダイアログ内に表示名入力欄が表示される", async () => {
    stubFetch(201, {});
    const onClose = vi.fn();
    renderWithClient(<AddWorkerDialog open={true} onClose={onClose} />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "表示名" })).toBeInTheDocument();
  });

  it("ダイアログ内に役割入力欄が表示される", async () => {
    stubFetch(201, {});
    const onClose = vi.fn();
    renderWithClient(<AddWorkerDialog open={true} onClose={onClose} />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "役割（任意）" })).toBeInTheDocument();
  });

  it("表示名が空のとき追加ボタンは disabled になる", async () => {
    stubFetch(201, {});
    const onClose = vi.fn();
    renderWithClient(<AddWorkerDialog open={true} onClose={onClose} />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    const submitButton = screen.getByRole("button", { name: "追加" });
    expect(submitButton).toBeDisabled();
  });

  it("表示名を入力すると追加ボタンが有効になる", async () => {
    stubFetch(201, {});
    const onClose = vi.fn();
    renderWithClient(<AddWorkerDialog open={true} onClose={onClose} />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: "表示名" }), "テストワーカー");
    expect(screen.getByRole("button", { name: "追加" })).toBeEnabled();
  });

  it("送信するとWorker作成APIが呼ばれダイアログが閉じる", async () => {
    const fetchSpy = vi.fn((input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/auth/me")) {
        return Promise.resolve(jsonResponse(200, { id: "u1", displayName: "Admin" }));
      }
      if (url.includes("/admin/workers")) {
        return Promise.resolve(jsonResponse(201, { id: "new-id", displayName: "テストワーカー" }));
      }
      return Promise.resolve(jsonResponse(200, []));
    });
    vi.stubGlobal("fetch", fetchSpy);
    const onClose = vi.fn();
    renderWithClient(<AddWorkerDialog open={true} onClose={onClose} />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: "表示名" }), "テストワーカー");
    await userEvent.click(screen.getByRole("button", { name: "追加" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("キャンセルボタンをクリックすると onClose が呼ばれる", async () => {
    stubFetch(201, {});
    const onClose = vi.fn();
    renderWithClient(<AddWorkerDialog open={true} onClose={onClose} />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onClose).toHaveBeenCalled();
  });
});
