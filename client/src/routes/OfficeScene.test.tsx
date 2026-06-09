import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OfficeScene } from "./OfficeScene.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubFetchWithEmployees(employees: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/api/employees")) {
        return Promise.resolve(jsonResponse(200, employees));
      }
      return Promise.resolve(jsonResponse(200, []));
    }),
  );
}

function renderOfficeScene(): ReturnType<typeof render> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = (): ReactElement => (
    <QueryClientProvider client={queryClient}>
      <OfficeScene />
    </QueryClientProvider>
  );
  return render(<Wrapper />);
}

describe("OfficeScene (#240)", () => {
  it('renders "仮想オフィス" heading', async () => {
    stubFetchWithEmployees([]);
    renderOfficeScene();
    expect(await screen.findByRole("heading", { name: "仮想オフィス" })).toBeInTheDocument();
  });

  it("API から取得した Bot Employee をキャラクターとして表示する", async () => {
    stubFetchWithEmployees([
      { id: "bot1", displayName: "テストBot", role: "テスト役職", isBot: true },
    ]);
    renderOfficeScene();
    expect(await screen.findByRole("button", { name: "テストBot" })).toBeInTheDocument();
  });

  it("Bot Employee が 0 件でも heading が表示される", async () => {
    stubFetchWithEmployees([]);
    renderOfficeScene();
    expect(await screen.findByRole("heading", { name: "仮想オフィス" })).toBeInTheDocument();
  });

  it("DEFAULT_EMPLOYEES に依存しない（API データが表示される）", async () => {
    stubFetchWithEmployees([
      { id: "api-bot", displayName: "APIBot", role: "APIRole", isBot: true },
    ]);
    renderOfficeScene();
    expect(await screen.findByRole("button", { name: "APIBot" })).toBeInTheDocument();
  });

  it("API 取得失敗時にエラーメッセージを表示する（SPA クラッシュしない）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(500, { message: "Internal Server Error" }))),
    );
    renderOfficeScene();
    expect(
      await screen.findByText("社員データの取得に失敗しました。"),
    ).toBeInTheDocument();
  });
});

// 受け入れ条件 #279: 横スクロール内部コンテナ
describe("横スクロール内部コンテナ (#279)", () => {
  it("OfficeView のラッパーコンテナ（data-testid='office-scroll-container'）がレンダリングされる", async () => {
    stubFetchWithEmployees([]);
    renderOfficeScene();

    // API 解決後に office-scroll-container がレンダリングされるのを待つ
    expect(await screen.findByTestId("office-scroll-container")).toBeInTheDocument();
  });
});
