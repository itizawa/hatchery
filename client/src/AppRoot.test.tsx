import { createMemoryHistory } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppRoot } from "./AppRoot";
import { createAppRouter } from "./router";

// 受け入れ条件 #5: ThemeProvider + QueryClientProvider + RouterProvider を合成し、
// クラッシュせずチャンネル一覧とホーム枠を描画する。
// テスト間の状態リークを避けるため memory history のルータを注入する。
describe("AppRoot", () => {
  beforeEach(() => {
    // URL ごとに応答を分ける: /auth/me はログイン済み(200 AuthUser)、GET /channels は既定チャンネル（#47）。
    // ホーム（/）はログイン必須（router の requireAuth ガード）のため、ログイン済みでないと /login へ
    // リダイレクトされ、サイドバー＋ホーム枠が描画されない。
    vi.stubGlobal(
      "fetch",
      vi.fn((input: Request | string) => {
        const url = typeof input === "string" ? input : input.url;
        if (url.includes("/auth/me")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: "testuser",
                displayName: "Test User",
                role: "admin",
                employeeId: "emp-testuser",
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            ),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify([{ id: "zatsudan", label: "雑談" }]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }),
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
    // 「雑談」は AddChannelForm のタイプ選択ラジオにも現れるため、サイドバーのチャンネル一覧内にスコープして確認する。
    const channelList = await screen.findByRole("list", { name: "チャンネル一覧" });
    expect(within(channelList).getByText("雑談")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /タイムライン/ })).toBeInTheDocument();
  });
});
