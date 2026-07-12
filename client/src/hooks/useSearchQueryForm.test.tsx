import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseSearchQueryParam } from "../routes/searchQueryParam.js";
import { useSearchQueryForm } from "./useSearchQueryForm.js";

type SearchQueryForm = ReturnType<typeof useSearchQueryForm>;

// テスト専用の最小ルータ。`useSearchQueryForm` が依存する
// useLocation/useNavigate/useSearch のコンテキストだけを満たすため、
// 本番の router.tsx（多数の遅延 import・認証ガードを持つ）は使わない。
// `/search` の q 抽出ロジックだけは `parseSearchQueryParam`（router.tsx と共有）を使い、
// 本番の searchRoute.validateSearch と挙動が乖離しないようにする。
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

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/search",
  component: Probe,
  validateSearch: parseSearchQueryParam,
});

const routeTree = rootRoute.addChildren([indexRoute, searchRoute]);

async function renderSearchQueryForm({
  initialPath,
  options,
}: {
  initialPath: string;
  options?: { preserveUnsyncedEdits?: boolean };
}) {
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
  beforeEach(() => {
    currentHookOptions = undefined;
    formRef.current = null;
  });

  it("/search 以外のパスでは URL に q があっても currentQ（フォーム初期値）が空文字になる", async () => {
    const { getForm } = await renderSearchQueryForm({ initialPath: "/?q=hello" });

    expect(getForm().state.values.q).toBe("");
  });

  // preserveUnsyncedEdits の値に関わらず、「未送信の編集が無い」場合は /search 上の q 変化に
  // フォーム値が追従してリセットされる（useSearchQueryForm.ts の
  // `!preserveUnsyncedEdits || !hasUnsyncedEdit` 判定の `!hasUnsyncedEdit` 側が真になる分岐）。
  //
  // フィールドはあえて setFieldValue で touch 済みにしてから検証する:
  // @tanstack/react-form の useForm は defaultValues 変更時、フィールドが isTouched で
  // なければ自動的に値を同期してしまう（form-core の FormApi.update の
  // shouldUpdateValues 判定）。touch していない状態のままだとこのライブラリ標準の自動同期
  // だけでテストが通ってしまい、useSearchQueryForm 独自の同期 effect（lastSyncedQRef
  // を使ったライブ比較）を実際には検証できない。touch 済みにすることでライブラリ標準の
  // 自動同期を無効化し、リセットが独自 effect によるものであることを保証する。
  describe.each([
    { label: "preserveUnsyncedEdits: false（既定）", options: undefined },
    { label: "preserveUnsyncedEdits: true", options: { preserveUnsyncedEdits: true } },
  ])("$label", ({ options }) => {
    it("touch 済み（未送信の編集なし）でも /search 上の q 変化にフォーム値がリセットされる", async () => {
      const { router, getForm } = await renderSearchQueryForm({
        initialPath: "/search?q=foo",
        options,
      });

      act(() => {
        getForm().setFieldValue("q", "foo");
      });

      await act(async () => {
        await router.navigate({ to: "/search", search: { q: "bar" } });
      });

      await waitFor(() => expect(getForm().state.values.q).toBe("bar"));
    });
  });

  it("preserveUnsyncedEdits: true かつ未送信の編集がある場合は /search 上の q 変化にリセットされない", async () => {
    const { router, getForm } = await renderSearchQueryForm({
      initialPath: "/search?q=foo",
      options: { preserveUnsyncedEdits: true },
    });

    act(() => {
      getForm().setFieldValue("q", "typing");
    });
    expect(getForm().state.values.q).toBe("typing");

    await act(async () => {
      await router.navigate({ to: "/search", search: { q: "bar" } });
    });

    // ルート遷移自体は成功しており（同期 effect の依存値 currentQ は "bar" に変化し、
    // effect は実行されている）、そのうえでフィールド値が未送信の編集（"typing"）のまま
    // 維持されることを検証する。location の変化を確認しないと、「effect が正しく
    // ガードして維持した」のか「効果が何も実行されていないだけ」なのかを区別できない。
    expect(router.state.location.search).toEqual({ q: "bar" });
    expect(getForm().state.values.q).toBe("typing");
  });

  it("onSubmit はトリムした値を持って /search へ navigate する", async () => {
    const { router, getForm } = await renderSearchQueryForm({ initialPath: "/" });
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

  it("/search を開いていてトリム後の値が現在の q と異なる場合は新しい q で /search へ navigate する", async () => {
    const { router, getForm } = await renderSearchQueryForm({ initialPath: "/search?q=foo" });
    const navigateSpy = vi.spyOn(router, "navigate");

    act(() => {
      getForm().setFieldValue("q", "  bar  ");
    });

    await act(async () => {
      await getForm().handleSubmit();
    });

    expect(navigateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ to: "/search", search: { q: "bar" } }),
    );
  });

  it("/search を開いていてトリム後の値が現在の q と同じ場合は navigate が呼ばれない", async () => {
    const { router, getForm } = await renderSearchQueryForm({ initialPath: "/search?q=cats" });
    const navigateSpy = vi.spyOn(router, "navigate");

    await act(async () => {
      await getForm().handleSubmit();
    });

    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
