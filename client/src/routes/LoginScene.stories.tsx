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
        http.get("/auth/me", () => new HttpResponse(null, { status: 401 })),
        ...handlers,
      ],
    },
  },
};

/**
 * ログイン成功後のリダイレクト再現。
 * POST /auth/login が成功すると / へ遷移する動作を確認できる。
 * global handlers をそのまま使う（/auth/me → admin、POST /auth/login → admin、
 * /channels → サイドバーのチャンネル一覧も正しく表示される）。
 * ナビゲーション再現ストーリー（受け入れ条件「少なくとも 1 つ」を満たす）。
 */
export const AfterLoginRedirect: Story = {
  render: () => renderWithRouter("/login"),
};
