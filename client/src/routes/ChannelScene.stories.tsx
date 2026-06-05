import type { Meta, StoryObj } from "@storybook/react";
import { http, HttpResponse } from "msw";
import { renderWithRouter } from "../mocks/RouterDecorator";

/**
 * ChannelScene（/channels/$channelId）のルートレベルストーリー。
 * MSW で API をモックし、実際のデータ込みで描画する（Issue #108）。
 * RouterProvider（memory history）内でのみ正しく描画できるため render で包む。
 */
const meta = {
  title: "routes/ChannelScene",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** チャンネル詳細（#雑談）: メッセージあり。 */
export const WithMessages: Story = {
  render: () => renderWithRouter("/channels/zatsudan"),
};

/** チャンネル詳細（#雑談）: メッセージ空。 */
export const Empty: Story = {
  render: () => renderWithRouter("/channels/zatsudan"),
  parameters: {
    msw: {
      handlers: [
        http.get("/channels/:channelId/messages", () => HttpResponse.json([])),
      ],
    },
  },
};
