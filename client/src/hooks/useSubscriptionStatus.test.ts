import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSubscriptionStatus } from "./useSubscriptionStatus.js";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useSubscriptionStatus (#421)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("サーバーが subscribed: false を返す場合、フックは false を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ subscribed: false }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );

    const { result } = renderHook(() => useSubscriptionStatus("technology"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.subscribed).toBe(false));
  });

  it("サーバーが subscribed: true を返す場合、フックは true を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: Request | string) => {
        const url = typeof input === "string" ? input : input.url;
        if (url.includes("/subscription")) {
          return Promise.resolve(
            new Response(JSON.stringify({ subscribed: true }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
      }),
    );

    const { result } = renderHook(() => useSubscriptionStatus("technology"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.subscribed).toBe(true));
  });
});
