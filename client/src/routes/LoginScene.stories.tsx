import type { Meta, StoryObj } from "@storybook/react";
import { http, HttpResponse } from "msw";
import { renderWithRouter } from "../mocks/RouterDecorator";
import { mockAdminUser } from "../mocks/data/fixtures";

/**
 * LoginScene（/login）のルートレベルストーリー。
 * RouterProvider（memory history）内で描画し useNavigate が正しく動く（Issue #108）。
 */
const meta = {
  title: "routes/LoginScene",
  parameters: {
    layout: "fullscreen",
    msw: {
      handlers: [
        http.get("/auth/me", () => new HttpResponse(null, { status: 401 })),
      ],
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** ログイン画面: 初期状態（未ログイン）。 */
export const Default: Story = {
  render: () => renderWithRouter("/login"),
};

/**
 * ログイン成功後のリダイレクト再現。
 * POST /auth/login が成功すると / へ遷移する動作を確認できる。
 * ナビゲーション再現ストーリー（受け入れ条件「少なくとも 1 つ」を満たす）。
 */
export const AfterLoginRedirect: Story = {
  render: () => renderWithRouter("/login"),
  parameters: {
    msw: {
      handlers: [
        http.get("/auth/me", () => HttpResponse.json(mockAdminUser)),
        http.post("/auth/login", () => HttpResponse.json(mockAdminUser)),
      ],
    },
  },
};
