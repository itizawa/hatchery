import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { LoginPromptSnackbar } from "./LoginPromptSnackbar";

/**
 * LoginPromptSnackbar は内部で TanStack Router の Link（→ /login）を使うため、
 * RouterProvider 配下で描画する。最小のメモリルータでラップする。
 */
function renderSnackbar(props: { open: boolean; onClose?: () => void }): ReactElement {
  const rootRoute = createRootRoute({
    component: () => <LoginPromptSnackbar open={props.open} onClose={props.onClose ?? vi.fn()} />,
  });
  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/login",
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([loginRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return <RouterProvider router={router} />;
}

describe("LoginPromptSnackbar (#481)", () => {
  it("open=true でログインが必要な旨の文言を表示する", async () => {
    render(renderSnackbar({ open: true }));
    expect(await screen.findByText(/投票するにはログインが必要です/)).toBeInTheDocument();
  });

  it("open=true で /login へのログインリンクを表示する", async () => {
    render(renderSnackbar({ open: true }));
    const link = await screen.findByRole("link", { name: /ログイン/ });
    expect(link).toHaveAttribute("href", "/login");
  });

  it("open=false では誘導文言を表示しない", () => {
    render(renderSnackbar({ open: false }));
    expect(screen.queryByText(/投票するにはログインが必要です/)).not.toBeInTheDocument();
  });
});
