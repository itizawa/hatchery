import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createAppRouter } from "./router";

// 受け入れ条件 #4: コードベース定義の最小ルート。ホーム（/）でタイムライン表示の枠が描画される。
describe("createAppRouter", () => {
  it("ホームルート（/）でタイムライン表示の枠の見出しを描画する", async () => {
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole("heading", { name: /タイムライン/ })).toBeInTheDocument();
  });

  it("サイドバーにチャンネル一覧（#雑談）を描画する", async () => {
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    render(<RouterProvider router={router} />);
    expect(await screen.findByText("#雑談")).toBeInTheDocument();
  });

  it("チャンネルルート（/channels/$channelId）で選択中チャンネル ID を描画する", async () => {
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: ["/channels/zatsudan"] }),
    });
    render(<RouterProvider router={router} />);
    expect(
      await screen.findByRole("heading", { name: /チャンネル: zatsudan/ }),
    ).toBeInTheDocument();
  });
});
