import { DEFAULT_EMPLOYEES, type Channel, type Employee, type Message } from "@hatchery/common";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChannelView } from "./ChannelView";

// 受け入れ条件（#30）: channel に属する message[] を発言者名 + 本文の
// フラット一覧として表示する presentational コンポーネント。
const channel: Channel = { id: "zatsudan", label: "#雑談" };

const employees: readonly Employee[] = [
  { id: "haru", displayName: "ハル" },
  { id: "ken", displayName: "ケン" },
];

const messages: readonly Message[] = [
  { speaker: "haru", channel: "zatsudan", text: "おはようございます！" },
  { speaker: "ken", channel: "zatsudan", text: "今日もよろしく。" },
];

describe("ChannelView", () => {
  it("チャンネルラベルを見出しとして表示する", () => {
    render(<ChannelView channel={channel} messages={messages} employees={employees} />);
    expect(screen.getByRole("heading", { name: "#雑談" })).toBeInTheDocument();
  });

  it("各メッセージの本文を表示する", () => {
    render(<ChannelView channel={channel} messages={messages} employees={employees} />);
    expect(screen.getByText("おはようございます！")).toBeInTheDocument();
    expect(screen.getByText("今日もよろしく。")).toBeInTheDocument();
  });

  it("speaker(ID) を employees の displayName に解決して表示する", () => {
    render(<ChannelView channel={channel} messages={messages} employees={employees} />);
    expect(screen.getByText("ハル")).toBeInTheDocument();
    expect(screen.getByText("ケン")).toBeInTheDocument();
  });

  it("未解決の speaker(ID) は ID をそのままフォールバック表示する", () => {
    const withUnknown: readonly Message[] = [
      { speaker: "unknown-id", channel: "zatsudan", text: "誰?" },
    ];
    render(<ChannelView channel={channel} messages={withUnknown} employees={employees} />);
    expect(screen.getByText("unknown-id")).toBeInTheDocument();
  });

  it("employees 省略時は DEFAULT_EMPLOYEES で解決する", () => {
    render(<ChannelView channel={channel} messages={messages} />);
    // DEFAULT_EMPLOYEES の haru の displayName は "haru"
    const haru = DEFAULT_EMPLOYEES.find((e) => e.id === "haru");
    expect(haru).toBeDefined();
    expect(screen.getByText(haru!.displayName)).toBeInTheDocument();
  });

  it("メッセージ件数ぶんの行を描画する", () => {
    render(<ChannelView channel={channel} messages={messages} employees={employees} />);
    const list = screen.getByRole("list", { name: "メッセージ一覧" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(messages.length);
  });

  it("messages が空のとき空状態を表示し、一覧は描画しない", () => {
    render(<ChannelView channel={channel} messages={[]} employees={employees} />);
    expect(screen.getByText(/まだメッセージがありません/)).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "メッセージ一覧" })).not.toBeInTheDocument();
  });
});
