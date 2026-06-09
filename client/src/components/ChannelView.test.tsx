import { DEFAULT_EMPLOYEES, type Channel, type Employee, type MessageRecord } from "@hatchery/common";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChannelView } from "./ChannelView";
import { DRIP_INTERVAL_MS, DRIP_TYPING_MS } from "../hooks/useDripMessages";

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

describe("ChannelView ドリップ表示（#282）", () => {
  const newMsg1: MessageRecord = {
    id: "msg-new-1",
    createdEmployeeId: "haru",
    channel: "zatsudan",
    text: "新しいメッセージ1",
    postedAt: new Date("2026-06-05T11:00:00Z"),
    createdAt: new Date("2026-06-05T11:00:00Z"),
    order: 2,
  };
  const newMsg2: MessageRecord = {
    id: "msg-new-2",
    createdEmployeeId: "ken",
    channel: "zatsudan",
    text: "新しいメッセージ2",
    postedAt: new Date("2026-06-05T11:01:00Z"),
    createdAt: new Date("2026-06-05T11:01:00Z"),
    order: 3,
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("初回ロード時の全メッセージが即時表示される（ドリップしない）", () => {
    render(<ChannelView channel={channel} messages={messages} employees={employees} />);
    expect(screen.getByText("おはようございます！")).toBeInTheDocument();
    expect(screen.getByText("今日もよろしく。")).toBeInTheDocument();
    expect(screen.queryByLabelText("入力中")).not.toBeInTheDocument();
  });

  it("新着追加直後はタイピングインジケータが表示され、新着メッセージはまだ非表示", () => {
    const { rerender } = render(<ChannelView channel={channel} messages={messages} employees={employees} />);

    rerender(<ChannelView channel={channel} messages={[...messages, newMsg1]} employees={employees} />);

    expect(screen.getByText("おはようございます！")).toBeInTheDocument();
    expect(screen.queryByText("新しいメッセージ1")).not.toBeInTheDocument();
    expect(screen.getByLabelText("入力中")).toBeInTheDocument();
  });

  it("DRIP_TYPING_MS 経過後に新着メッセージが表示され、タイピングインジケータが消える", () => {
    const { rerender } = render(<ChannelView channel={channel} messages={messages} employees={employees} />);
    rerender(<ChannelView channel={channel} messages={[...messages, newMsg1]} employees={employees} />);

    act(() => {
      vi.advanceTimersByTime(DRIP_TYPING_MS);
    });

    expect(screen.getByText("新しいメッセージ1")).toBeInTheDocument();
    expect(screen.queryByLabelText("入力中")).not.toBeInTheDocument();
  });

  it("複数の新着が順番に（1件ずつ）表示される", () => {
    const { rerender } = render(<ChannelView channel={channel} messages={messages} employees={employees} />);
    rerender(<ChannelView channel={channel} messages={[...messages, newMsg1, newMsg2]} employees={employees} />);

    // 1件目: typing 中
    expect(screen.queryByText("新しいメッセージ1")).not.toBeInTheDocument();
    expect(screen.queryByText("新しいメッセージ2")).not.toBeInTheDocument();
    expect(screen.getByLabelText("入力中")).toBeInTheDocument();

    // 1件目表示
    act(() => {
      vi.advanceTimersByTime(DRIP_TYPING_MS);
    });
    expect(screen.getByText("新しいメッセージ1")).toBeInTheDocument();
    expect(screen.queryByText("新しいメッセージ2")).not.toBeInTheDocument();

    // DRIP_INTERVAL_MS 後に2件目の typing 開始
    act(() => {
      vi.advanceTimersByTime(DRIP_INTERVAL_MS);
    });
    expect(screen.getByLabelText("入力中")).toBeInTheDocument();

    // 2件目表示
    act(() => {
      vi.advanceTimersByTime(DRIP_TYPING_MS);
    });
    expect(screen.getByText("新しいメッセージ2")).toBeInTheDocument();
    expect(screen.queryByLabelText("入力中")).not.toBeInTheDocument();
  });

  it("初回ロード済みメッセージは再レンダリング後も即時表示のまま（ドリップ再生しない）", () => {
    const { rerender } = render(<ChannelView channel={channel} messages={messages} employees={employees} />);

    // 同じメッセージで再レンダリング
    rerender(<ChannelView channel={channel} messages={messages.slice()} employees={employees} />);

    expect(screen.getByText("おはようございます！")).toBeInTheDocument();
    expect(screen.getByText("今日もよろしく。")).toBeInTheDocument();
    expect(screen.queryByLabelText("入力中")).not.toBeInTheDocument();
  });
});

describe("ChannelView ドリップ表示 - reduced-motion（#282）", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const newMsg: MessageRecord = {
    id: "msg-reduced",
    createdEmployeeId: "haru",
    channel: "zatsudan",
    text: "reduced-motion テスト",
    postedAt: new Date("2026-06-05T11:00:00Z"),
    createdAt: new Date("2026-06-05T11:00:00Z"),
    order: 2,
  };

  it("prefers-reduced-motion 時は新着が即時表示されタイピングインジケータを出さない", () => {
    const { rerender } = render(<ChannelView channel={channel} messages={messages} employees={employees} />);
    rerender(<ChannelView channel={channel} messages={[...messages, newMsg]} employees={employees} />);

    expect(screen.getByText("reduced-motion テスト")).toBeInTheDocument();
    expect(screen.queryByLabelText("入力中")).not.toBeInTheDocument();
  });
});
