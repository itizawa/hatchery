import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { useState, type ReactElement } from "react";

import { createAppRouter } from "../router.js";

interface RouterStoryProps {
  path: string;
}

/** TanStack Router（memory history）でラップし、指定パスで画面を描画する。 */
function RouterStory({ path }: RouterStoryProps): ReactElement {
  const [router] = useState(() =>
    createAppRouter({ history: createMemoryHistory({ initialEntries: [path] }) }),
  );
  return <RouterProvider router={router} />;
}

/**
 * 指定パスに memory history で遷移した状態の RouterProvider を返す render 関数。
 * 受け入れ条件「TanStack Router（memory history）を使う decorator が用意され、
 * 画面内のリンク／リダイレクトで遷移が再現できる」を満たす（Issue #108）。
 *
 * 使用例:
 * ```ts
 * export const Default: Story = { render: () => renderWithRouter('/login') };
 * ```
 */
export const renderWithRouter = (path: string): ReactElement => (
  <RouterStory path={path} />
);
