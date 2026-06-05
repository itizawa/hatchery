import type { Meta, StoryObj } from "@storybook/react";
import { HomeScene } from "./HomeScene";

const meta = {
  title: "routes/HomeScene",
  component: HomeScene,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof HomeScene>;

export default meta;
type Story = StoryObj<typeof meta>;

/** ホーム（/）: タイムラインの枠を表示する。 */
export const Default: Story = {};
