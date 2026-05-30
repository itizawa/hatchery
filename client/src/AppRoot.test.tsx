import { createMemoryHistory } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppRoot } from "./AppRoot";
import { createAppRouter } from "./router";

// 受け入れ条件 #5: ThemeProvider + QueryClientProvider + RouterProvider を合成し、
// クラッシュせずチャンネル一覧とホーム枠を描画する。
// テスト間の状態リークを避けるため memory history のルータを注入する。
describe("AppRoot", () => {
  it("クラッシュせずチャンネル一覧とホーム枠を描画する", async () => {
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    render(<AppRoot router={router} />);
    expect(await screen.findByText("#雑談")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /タイムライン/ })).toBeInTheDocument();
  });
});
