import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AddChannelForm } from "./AddChannelForm";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** URL に応じて応答を切り替える fetch スタブ（/auth/me を主に分岐）。 */
function stubFetch(meStatus: number, meBody: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/auth/me")) {
        return Promise.resolve(jsonResponse(meStatus, meBody));
      }
      return Promise.resolve(jsonResponse(201, { id: "new", label: "#新規" }));
    }),
  );
}

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

// 受け入れ条件 AC7: ログイン時のみ表示されるチャンネル追加 UI。未ログインでは表示しない。
describe("AddChannelForm（ログイン時のみ表示・#47）", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ログイン時はチャンネル追加フォームを表示する", async () => {
    stubFetch(200, { id: "u1", displayName: "Alice" });
    renderWithClient(<AddChannelForm />);
    expect(await screen.findByRole("button", { name: "追加" })).toBeInTheDocument();
  });

  it("未ログイン（401）のときは何も表示しない", async () => {
    const fetchSpy = vi.fn((input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      return Promise.resolve(jsonResponse(url.includes("/auth/me") ? 401 : 201, { error: "x" }));
    });
    vi.stubGlobal("fetch", fetchSpy);
    const { container } = renderWithClient(<AddChannelForm />);
    // useAuth（GET /auth/me）が実際に呼ばれ 401 で解決したことを待ってから、何も描画されないことを検証する。
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "追加" })).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});
