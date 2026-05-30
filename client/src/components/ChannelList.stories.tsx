import type { Meta, StoryObj } from "@storybook/react";
import { ChannelList } from "./ChannelList";

const meta = {
  title: "components/ChannelList",
  component: ChannelList,
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof ChannelList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
