import type { Meta, StoryObj } from "@storybook/react";
import { http, HttpResponse } from "msw";
import { renderWithRouter } from "../mocks/RouterDecorator";

/**
 * SettingsScene（/admin）のルートレベルストーリー。
 * useSearch({ from: "/admin" }) / useNavigate({ from: "/admin" }) の依存から
 * RouterProvider（memory history）内でのみ正しく描画できる（Issue #108）。
 * beforeLoad の requireAdminRoute が /auth/me を呼ぶため MSW で admin ユーザーを返す。
 */
const meta = {
  title: "routes/SettingsScene",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** 管理画面（ユーザー一覧タブ）: admin ログイン済み。 */
export const UsersTab: Story = {
  render: () => renderWithRouter("/admin?tab=users"),
};

/** 管理画面（API トークン設定タブ）: admin ログイン済み。 */
export const ApiTokenTab: Story = {
  render: () => renderWithRouter("/admin?tab=api-token"),
};

/** 管理画面（バッチログタブ）: admin ログイン済み。 */
export const BatchLogsTab: Story = {
  render: () => renderWithRouter("/admin?tab=batch-logs"),
};

/**
 * 未認証時のリダイレクト再現（ナビゲーション確認）。
 * #454: /admin にアクセスすると beforeLoad が 401 を受け取り /?login=1 へリダイレクトし、
 * 公開ホーム上にログインモーダルを開く。TanStack Router の memory history で再現できる。
 */
export const RedirectsToLoginWhenUnauthenticated: Story = {
  render: () => renderWithRouter("/admin"),
  parameters: {
    msw: {
      handlers: [
        http.get("/api/auth/me", () => new HttpResponse(null, { status: 401 })),
      ],
    },
  },
};
