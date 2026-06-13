import type { Meta, StoryObj } from "@storybook/react";

import { LoginDialog } from "./LoginDialog";

/**
 * LoginDialog（#454）のコンポーネントレベルストーリー。
 * ログインはモーダル（MUI Dialog）で表示し、Google 認証のみ（#455）を提供する。
 */
const meta = {
  title: "components/LoginDialog",
  component: LoginDialog,
  args: {
    open: true,
    onClose: () => {},
  },
} satisfies Meta<typeof LoginDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** ログインモーダル: 開いた状態。 */
export const Open: Story = {};

/** ログインモーダル: 閉じた状態（何も表示されない）。 */
export const Closed: Story = {
  args: { open: false },
};
