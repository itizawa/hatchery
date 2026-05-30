import { DEFAULT_CHANNELS, DEFAULT_EMPLOYEES } from "@hatchery/common";
import type { Meta, StoryObj } from "@storybook/react";

import { getFixtureMessages } from "../fixtures/channelMessages";
import { ChannelView } from "./ChannelView";

const zatsudan = DEFAULT_CHANNELS.find((c) => c.id === "zatsudan") ?? DEFAULT_CHANNELS[0];

const meta = {
  title: "components/ChannelView",
  component: ChannelView,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    employees: DEFAULT_EMPLOYEES,
  },
} satisfies Meta<typeof ChannelView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 通常: 複数社員の掛け合いを fixture で表示する。 */
export const Default: Story = {
  args: {
    channel: zatsudan,
    messages: getFixtureMessages("zatsudan"),
  },
};

/** 空状態: メッセージが 1 件も無いチャンネル。 */
export const Empty: Story = {
  args: {
    channel: zatsudan,
    messages: [],
  },
};
