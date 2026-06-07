import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { mockAdminUser, mockChannels, mockMessages } from "../mocks/data/fixtures.js";
import { ChannelScene } from "./ChannelScene.js";

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-router")>(
    "@tanstack/react-router",
  );
  return { ...actual, useParams: () => ({ channelId: "zatsudan" }) };
});

vi.mock("../api/channels.js", () => ({
  useChannels: () => ({ data: mockChannels }),
  useChannelMessages: () => ({ data: mockMessages }),
  usePostChannelMessage: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateChannel: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("../api/auth.js", async () => {
  const actual = await vi.importActual<typeof import("../api/auth.js")>("../api/auth.js");
  return { ...actual, useAuth: () => ({ data: mockAdminUser }) };
});

describe("ChannelScene レイアウト (#203)", () => {
  it("MessageInput（送信ボタン）が ChannelView（メッセージ一覧）より後ろ（下）に位置する", () => {
    render(<ChannelScene />);

    const messageList = screen.getByRole("list", { name: "メッセージ一覧" });
    const submitButton = screen.getByRole("button", { name: /送信/ });

    // DOCUMENT_POSITION_FOLLOWING (4): submitButton は messageList の後ろにある
    expect(
      messageList.compareDocumentPosition(submitButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
