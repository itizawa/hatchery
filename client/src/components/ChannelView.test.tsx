import { DEFAULT_EMPLOYEES, type Channel, type Employee, type MessageRecord } from "@hatchery/common";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChannelView } from "./ChannelView";

// 受け入れ条件（#30）: channel に属する message[] を発言者名 + 本文の
// フラット一覧として表示する presentational コンポーネント。
const channel: Channel = { id: "zatsudan", label: "雑談" };

const employees: readonly Employee[] = [
  { id: "haru", displayName: "ハル" },
  { id: "ken", displayName: "ケン" },
];

const messages: readonly MessageRecord[] = [
  {
    id: "msg-1",
    createdEmployeeId: "haru",
    channel: "zatsudan",
    text: "おはようございます！",
    postedAt: new Date("2026-06-05T09:00:00Z"),
    createdAt: new Date("2026-06-05T09:00:00Z"),
    order: 0,
  },
  {
    id: "msg-2",
    createdEmployeeId: "ken",
    channel: "zatsudan",
    text: "今日もよろしく。",
    postedAt: new Date("2026-06-05T10:30:00Z"),
    createdAt: new Date("2026-06-05T10:30:00Z"),
    order: 1,
  },
];

const formatPostedAt = (date: Date): string =>
  new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);

describe("ChannelView", () => {
  it("チャンネルラベルを見出しとして表示する", () => {
    render(<ChannelView channel={channel} messages={messages} employees={employees} />);
    expect(screen.getByRole("heading", { name: "雑談" })).toBeInTheDocument();
  });

  it("各メッセージの本文を表示する", () => {
    render(<ChannelView channel={channel} messages={messages} employees={employees} />);
    expect(screen.getByText("おはようございます！")).toBeInTheDocument();
    expect(screen.getByText("今日もよろしく。")).toBeInTheDocument();
  });

  it("createdEmployeeId を employees の displayName に解決して表示する（#222）", () => {
    render(<ChannelView channel={channel} messages={messages} employees={employees} />);
    expect(screen.getByText("ハル")).toBeInTheDocument();
    expect(screen.getByText("ケン")).toBeInTheDocument();
  });

  it("未解決の createdEmployeeId は ID をそのままフォールバック表示する（#222）", () => {
    const withUnknown: readonly MessageRecord[] = [
      {
        id: "msg-unknown",
        createdEmployeeId: "unknown-id",
        channel: "zatsudan",
        text: "誰?",
        postedAt: new Date("2026-06-05T09:00:00Z"),
        createdAt: new Date("2026-06-05T09:00:00Z"),
        order: 0,
      },
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

  it("postedAt の時刻を HH:mm 形式で各メッセージに表示する（#278）", () => {
    render(<ChannelView channel={channel} messages={messages} employees={employees} />);
    expect(screen.getByText(formatPostedAt(messages[0].postedAt))).toBeInTheDocument();
    expect(screen.getByText(formatPostedAt(messages[1].postedAt))).toBeInTheDocument();
  });
});

describe("ChannelView 編集ボタン（#206）", () => {
  it("onEditName が渡されると編集ボタンが表示される", () => {
    render(<ChannelView channel={channel} messages={[]} onEditName={vi.fn()} />);
    expect(screen.getByRole("button", { name: "チャンネル名を編集" })).toBeInTheDocument();
  });

  it("onEditName が渡されないと編集ボタンは表示されない（未ログイン相当）（AC-f）", () => {
    render(<ChannelView channel={channel} messages={[]} />);
    expect(screen.queryByRole("button", { name: "チャンネル名を編集" })).not.toBeInTheDocument();
  });

  it("編集ボタンをクリックすると onEditName が呼ばれる", async () => {
    const onEditName = vi.fn();
    render(<ChannelView channel={channel} messages={[]} onEditName={onEditName} />);
    await userEvent.click(screen.getByRole("button", { name: "チャンネル名を編集" }));
    expect(onEditName).toHaveBeenCalled();
  });
});
