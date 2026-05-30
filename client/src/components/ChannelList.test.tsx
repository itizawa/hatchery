import { DEFAULT_CHANNELS } from "@hatchery/common";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChannelList } from "./ChannelList";

// 受け入れ条件 #2 / #6: common の DEFAULT_CHANNELS を描画（client → common の実依存）。
describe("ChannelList", () => {
  it("common の DEFAULT_CHANNELS のラベルをすべて描画する", () => {
    render(<ChannelList />);
    for (const channel of DEFAULT_CHANNELS) {
      expect(screen.getByText(channel.label)).toBeInTheDocument();
    }
  });

  it("既定では 2 チャンネル（#雑談 / #仕事）を描画する", () => {
    render(<ChannelList />);
    expect(screen.getByText("#雑談")).toBeInTheDocument();
    expect(screen.getByText("#仕事")).toBeInTheDocument();
  });
});
