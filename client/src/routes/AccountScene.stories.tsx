import type { Meta, StoryObj } from "@storybook/react";
import { AccountScene } from "./AccountScene";

const meta = {
  title: "routes/AccountScene",
  component: AccountScene,
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof AccountScene>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
