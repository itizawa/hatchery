import type { Meta, StoryObj } from "@storybook/react";
import { http, HttpResponse } from "msw";
import { handlers } from "../mocks/handlers.js";
import { renderWithRouter } from "../mocks/RouterDecorator";

/**
 * LoginScene（/login）のルートレベルストーリー。
 * RouterProvider（memory history）内で描画し useNavigate が正しく動く（Issue #108）。
 */
const meta = {
  title: "routes/LoginScene",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * ログイン画面: 初期状態（未ログイン）。
 * /auth/me を 401 にオーバーライドしつつ、global handlers もスプレッドして
 * サイドバー等のハンドラを維持する（story-level は global handlers を置き換えるため）。
 */
export const Default: Story = {
  render: () => renderWithRouter("/login"),
  parameters: {
    msw: {
      handlers: [
        http.get("/api/auth/me", () => new HttpResponse(null, { status: 401 })),
        ...handlers,
      ],
    },
  },
};

/**
 * ログイン済み状態で /login にアクセスすると / へリダイレクトする再現。
 * global handlers をそのまま使う（/auth/me → admin ユーザー返却）。
 */
export const AfterLoginRedirect: Story = {
  render: () => renderWithRouter("/login"),
};
