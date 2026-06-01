import { createMemoryHistory } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppRoot } from "./AppRoot";
import { createAppRouter } from "./router";

// 受け入れ条件 #5: ThemeProvider + QueryClientProvider + RouterProvider を合成し、
// クラッシュせずチャンネル一覧とホーム枠を描画する。
// テスト間の状態リークを避けるため memory history のルータを注入する。
describe("AppRoot", () => {
  beforeEach(() => {
    // サイドバー（ChannelList）が呼ぶ GET /channels を既定チャンネルで応答する（#47）。
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify([{ id: "zatsudan", label: "#雑談" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("クラッシュせずチャンネル一覧とホーム枠を描画する", async () => {
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    render(<AppRoot router={router} />);
    expect(await screen.findByText("#雑談")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /タイムライン/ })).toBeInTheDocument();
  });
});
