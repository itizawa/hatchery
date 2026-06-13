import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { Suspense, type ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SubscriptionStatus } from "./SubscriptionStatus.js";

function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div data-testid="loading" />}>{ui}</Suspense>
    </QueryClientProvider>,
  );
}

describe("SubscriptionStatus (#421 / #461)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("サーバーが subscribed: true を返すと render-prop に true が渡る", async () => {
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

    renderWithProviders(
      <SubscriptionStatus communitySlug="technology">
        {(subscribed) => <div>{subscribed ? "subscribed" : "not-subscribed"}</div>}
      </SubscriptionStatus>,
    );

    expect(await screen.findByText("subscribed")).toBeInTheDocument();
  });

  it("サーバーが subscribed: false を返すと render-prop に false が渡る", async () => {
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

    renderWithProviders(
      <SubscriptionStatus communitySlug="technology">
        {(subscribed) => <div>{subscribed ? "subscribed" : "not-subscribed"}</div>}
      </SubscriptionStatus>,
    );

    expect(await screen.findByText("not-subscribed")).toBeInTheDocument();
  });

  it("communitySlug が空のとき購読状態 fetch を実行せず render-prop に false が渡る", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ subscribed: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders(
      <SubscriptionStatus communitySlug="">
        {(subscribed) => <div>{subscribed ? "subscribed" : "not-subscribed"}</div>}
      </SubscriptionStatus>,
    );

    // slug 空のときは即座に false を描画し、購読状態 fetch は走らない（Suspense もしない）。
    expect(await screen.findByText("not-subscribed")).toBeInTheDocument();
    expect(screen.queryByTestId("loading")).not.toBeInTheDocument();

    await waitFor(() => {
      const subscriptionCalls = fetchMock.mock.calls.filter(([input]) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        return url.includes("/subscription");
      });
      expect(subscriptionCalls).toHaveLength(0);
    });
  });
});
