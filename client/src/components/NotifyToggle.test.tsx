import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NotifyToggle } from "./NotifyToggle";

describe("NotifyToggle（#1088）", () => {
  it("notifyEnabled: true のとき ON 状態のラベル・アイコンで表示する", () => {
    render(<NotifyToggle notifyEnabled={true} onToggle={vi.fn()} />);
    expect(screen.getByRole("button", { name: "通知をオフにする" })).toBeInTheDocument();
  });

  it("notifyEnabled: false のとき OFF 状態のラベル・アイコンで表示する", () => {
    render(<NotifyToggle notifyEnabled={false} onToggle={vi.fn()} />);
    expect(screen.getByRole("button", { name: "通知をオンにする" })).toBeInTheDocument();
  });

  it("クリックすると onToggle が呼ばれる", async () => {
    const onToggle = vi.fn();
    render(<NotifyToggle notifyEnabled={true} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole("button", { name: "通知をオフにする" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("disabled のときボタンが disabled になる", () => {
    render(<NotifyToggle notifyEnabled={true} onToggle={vi.fn()} disabled />);
    expect(screen.getByRole("button", { name: "通知をオフにする" })).toBeDisabled();
  });
});
