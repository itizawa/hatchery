import { DEFAULT_CHANNELS, DEFAULT_EMPLOYEES, type Employee } from "@hatchery/common";
import type { Meta, StoryObj } from "@storybook/react";

import { getFixtureMessages } from "../fixtures/channelMessages";
import { ChannelView } from "./ChannelView";

const zatsudan = DEFAULT_CHANNELS.find((c) => c.id === "zatsudan") ?? DEFAULT_CHANNELS[0];

/** 画像あり / 画像なしの Employee が混在するフィクスチャ（#300）。 */
const employeesWithMixedImages: readonly Employee[] = [
  {
    id: "haru",
    displayName: "haru",
    role: "ムードメーカー",
    isBot: true,
    // 画像あり: Picsum Photos の固定シードで再現性を確保
    imageUrl: "https://picsum.photos/seed/haru/200/200",
  },
  {
    id: "ken",
    displayName: "ken",
    role: "ベテラン",
    isBot: true,
    // 画像なし: イニシャルフォールバックを確認
  },
  {
    id: "mei",
    displayName: "mei",
    role: "新人",
    isBot: true,
    imageUrl: "https://picsum.photos/seed/mei/200/200",
  },
];

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

/** アバター画像あり / なし混在: 画像設定済みの社員と未設定の社員が混在する状態（#300）。 */
export const WithMixedAvatars: Story = {
  args: {
    channel: zatsudan,
    messages: getFixtureMessages("zatsudan"),
    employees: employeesWithMixedImages,
  },
};

/** 空状態: メッセージが 1 件も無いチャンネル。 */
export const Empty: Story = {
  args: {
    channel: zatsudan,
    messages: [],
  },
};
