import type { Meta, StoryObj } from "@storybook/react";
import { http, HttpResponse } from "msw";
import { AccountScene } from "./AccountScene";

/**
 * AccountScene（/account）のストーリー。
 * useAuth() が /auth/me を呼ぶため MSW でモックする（Issue #108）。
 */
const meta = {
  title: "routes/AccountScene",
  component: AccountScene,
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof AccountScene>;

export default meta;
type Story = StoryObj<typeof meta>;

/** アカウント設定: ログイン済みユーザーのプロフィールが表示される。 */
export const Default: Story = {};

/** アカウント設定: 未ログイン状態（auth/me が 401）。フォームは空になる。 */
export const LoggedOut: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/auth/me", () => new HttpResponse(null, { status: 401 })),
      ],
    },
  },
};
