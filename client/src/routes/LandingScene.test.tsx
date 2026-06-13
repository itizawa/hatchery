import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";

import { LandingScene } from "./LandingScene";

/**
 * LandingScene は内部で TanStack Router の Link（CTA → ?login=1 でログインモーダルを開く）を使うため、
 * RouterProvider 配下で描画する必要がある。最小のメモリルータでラップする。
 * #454: CTA は専用ページへ遷移せず、現在パス（/lp）に login search param を付与する URL 駆動。
 */
function renderLandingScene(): ReactElement {
  const rootRoute = createRootRoute({
    component: LandingScene,
    validateSearch: (search: Record<string, unknown>): { login?: boolean } =>
      search.login === true || search.login === "1" ? { login: true } : {},
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([]),
    history: createMemoryHistory({ initialEntries: ["/lp"] }),
  });
  return <RouterProvider router={router} />;
}

describe("LandingScene", () => {
  it("ヒーローにプロダクト名「Hatchery」の見出しを表示する", async () => {
    render(renderLandingScene());
    expect(await screen.findByRole("heading", { name: /Hatchery/ })).toBeInTheDocument();
  });

  it("コンセプトを一言で表すキャッチコピーを表示する", async () => {
    render(renderLandingScene());
    // 「放置して眺める、自分の会社の AI 社員」の趣旨（観察エンタメ）。
    expect((await screen.findAllByText(/放置して眺める/)).length).toBeGreaterThan(0);
  });

  it("中核の魅力 (a) 同じ顔ぶれが継続し記憶でキャラが立つ を見出しで表示する", async () => {
    render(renderLandingScene());
    const heading = await screen.findByRole("heading", { name: /同じ顔ぶれ.*キャラ/ });
    expect(heading).toBeInTheDocument();
  });

  it("中核の魅力 (b) 定時にだけ動く を見出しで表示する", async () => {
    render(renderLandingScene());
    expect(await screen.findByRole("heading", { name: /定時にだけ動く/ })).toBeInTheDocument();
  });

  it("中核の魅力 (c) 覗くと変化が育つ（観察→関与→変化の実感ループ）を見出しで表示する", async () => {
    render(renderLandingScene());
    expect(await screen.findByRole("heading", { name: /覗くと変化が育つ/ })).toBeInTheDocument();
    // 観察 → 関与 → 変化の実感ループの説明文も含む。
    expect((await screen.findAllByText(/観察 → 関与 → 変化/)).length).toBeGreaterThan(0);
  });

  // #454: CTA は専用ログインページへ遷移せず、現在パスに ?login=1 を付与してモーダルを開く。
  it("ログインモーダルを開く CTA リンク（href に login=1 を含む）を表示する", async () => {
    render(renderLandingScene());
    const cta = await screen.findByRole("link", { name: /ログイン|はじめる/ });
    expect(cta.getAttribute("href")).toMatch(/login=(1|true)/);
  });
});
