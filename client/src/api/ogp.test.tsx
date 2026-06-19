import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchOgp, useOgp } from "./ogp.js";

const NULL_OGP_META = { title: null, description: null, image: null, site_name: null };

// eslint-disable-next-line max-params
function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchOgp", () => {
  it("200 のとき OGP メタデータを返す", async () => {
    const ogpData = {
      title: "テスト記事",
      description: "テスト説明",
      image: "https://example.com/image.png",
      site_name: "Example Site",
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, ogpData));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchOgp("https://example.com");
    expect(result).toEqual(ogpData);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/ogp");
    expect(request.url).toContain(encodeURIComponent("https://example.com"));
  });

  it("404 のとき null 埋め OgpMeta を返す", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(404));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchOgp("https://example.com/not-found");
    expect(result).toEqual(NULL_OGP_META);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("500 のとき null 埋め OgpMeta を返す", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(500));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchOgp("https://example.com/error");
    expect(result).toEqual(NULL_OGP_META);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("useOgp", () => {
  it("url が null のとき fetch を呼ばない", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useOgp(null), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("url が文字列のとき GET /api/ogp?url= を呼ぶ", async () => {
    const ogpData = { title: "記事タイトル", description: null, image: null, site_name: null };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, ogpData));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useOgp("https://example.com"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/ogp");
    expect(request.url).toContain(encodeURIComponent("https://example.com"));
  });
});
