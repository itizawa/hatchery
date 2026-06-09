import { createMemoryHistory } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppRoot } from "./AppRoot";
import { createAppRouter } from "./router";

// 受け入れ条件 #307: ThemeProvider + QueryClientProvider + RouterProvider を合成し、
// クラッシュせずコミュニティ一覧とホームフィード枠を描画する。
// テスト間の状態リークを避けるため memory history のルータを注入する。
describe("AppRoot", () => {
  beforeEach(() => {
    // URL ごとに応答を分ける: /auth/me はログイン済み(200 AuthUser)、GET /api/communities はコミュニティ一覧
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
        if (url.includes("/api/communities") && !url.includes("/feed") && !url.includes("/subscribe")) {
          return Promise.resolve(
            new Response(
              JSON.stringify([{ id: "c-1", slug: "ai-dev", name: "AI 開発者の集い", description: "", created_at: "2026-06-01T00:00:00Z" }]),
              { status: 200, headers: { "Content-Type": "application/json" } },
            ),
          );
        }
        if (url.includes("/api/feed")) {
          return Promise.resolve(
            new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }),
        );
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("クラッシュせずコミュニティ一覧とホームフィード枠を描画する", async () => {
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    render(<AppRoot router={router} />);
    // サイドバーのコミュニティセクション「コミュニティ」ラベルが表示される
    expect(await screen.findByText("コミュニティ")).toBeInTheDocument();
    // ホームフィードの見出しが表示される
    expect(await screen.findByRole("heading", { name: /ホームフィード/ })).toBeInTheDocument();
  });
});
