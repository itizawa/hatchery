import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSearchQueryForm } from "./useSearchQueryForm.js";

type SearchQueryForm = ReturnType<typeof useSearchQueryForm>;

// テスト専用の最小ルータ。`useSearchQueryForm` が依存する
// useLocation/useNavigate/useSearch のコンテキストだけを満たすため、
// 本番の router.tsx（多数の遅延 import・認証ガードを持つ）は使わない。
let currentHookOptions: { preserveUnsyncedEdits?: boolean } | undefined;
const formRef: { current: SearchQueryForm | null } = { current: null };

function Probe() {
  formRef.current = useSearchQueryForm(currentHookOptions);
  return null;
}

const rootRoute = createRootRoute({ component: () => <Outlet /> });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Probe,
});

// 本番の searchRoute（client/src/router.tsx）と同じ q 抽出ロジック。
const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/search",
  component: Probe,
  validateSearch: (search: Record<string, unknown>): { q?: string } => {
    const q = typeof search.q === "string" && search.q.trim().length > 0 ? search.q.trim() : undefined;
    return q !== undefined ? { q } : {};
  },
});

const routeTree = rootRoute.addChildren([indexRoute, searchRoute]);

async function renderSearchQueryForm(
  initialPath: string,
  options?: { preserveUnsyncedEdits?: boolean },
) {
  currentHookOptions = options;
  formRef.current = null;
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  render(<RouterProvider router={router} />);
  await waitFor(() => expect(formRef.current).not.toBeNull());
  return { router, getForm: () => formRef.current! };
}

describe("useSearchQueryForm", () => {
  it("/search 以外のパスでは URL に q があっても currentQ（フォーム初期値）が空文字になる", async () => {
    const { getForm } = await renderSearchQueryForm("/?q=hello");

    expect(getForm().state.values.q).toBe("");
  });

  it("preserveUnsyncedEdits: false（既定）では /search 上の q 変化にフォーム値が追従してリセットされる", async () => {
    const { router, getForm } = await renderSearchQueryForm("/search?q=foo");

    expect(getForm().state.values.q).toBe("foo");

    await act(async () => {
      await router.navigate({ to: "/search", search: { q: "bar" } });
    });

    await waitFor(() => expect(getForm().state.values.q).toBe("bar"));
  });

  it("preserveUnsyncedEdits: true かつ未送信の編集がある場合は /search 上の q 変化にリセットされない", async () => {
    const { router, getForm } = await renderSearchQueryForm("/search?q=foo", {
      preserveUnsyncedEdits: true,
    });

    act(() => {
      getForm().setFieldValue("q", "typing");
    });
    expect(getForm().state.values.q).toBe("typing");

    await act(async () => {
      await router.navigate({ to: "/search", search: { q: "bar" } });
    });

    expect(getForm().state.values.q).toBe("typing");
  });

  it("preserveUnsyncedEdits: true でも未送信の編集が無ければ /search 上の q 変化にリセットされる", async () => {
    const { router, getForm } = await renderSearchQueryForm("/search?q=foo", {
      preserveUnsyncedEdits: true,
    });

    expect(getForm().state.values.q).toBe("foo");

    await act(async () => {
      await router.navigate({ to: "/search", search: { q: "bar" } });
    });

    await waitFor(() => expect(getForm().state.values.q).toBe("bar"));
  });

  it("onSubmit はトリムした値を持って /search へ navigate する", async () => {
    const { router, getForm } = await renderSearchQueryForm("/");
    const navigateSpy = vi.spyOn(router, "navigate");

    act(() => {
      getForm().setFieldValue("q", "  cats  ");
    });

    await act(async () => {
      await getForm().handleSubmit();
    });

    expect(navigateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ to: "/search", search: { q: "cats" } }),
    );
  });

  it("/search を開いていてトリム後の値が現在の q と同じ場合は navigate が呼ばれない", async () => {
    const { router, getForm } = await renderSearchQueryForm("/search?q=cats");
    const navigateSpy = vi.spyOn(router, "navigate");

    await act(async () => {
      await getForm().handleSubmit();
    });

    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
