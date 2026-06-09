import type { Meta, StoryObj } from "@storybook/react";

import { TypingIndicator } from "./TypingIndicator";

const meta = {
  title: "components/TypingIndicator",
  component: TypingIndicator,
} satisfies Meta<typeof TypingIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 新着メッセージ本文が出る直前に、その発言者が入力中であることを示すインジケータ（#282）。 */
export const Default: Story = {
  args: {
    name: "ハル",
  },
};
