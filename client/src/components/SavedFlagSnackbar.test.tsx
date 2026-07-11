import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SavedFlagSnackbar } from "./SavedFlagSnackbar";

describe("SavedFlagSnackbar", () => {
  it("open が true のとき message が表示される", () => {
    render(<SavedFlagSnackbar open onClose={() => {}} message="保存しました" />);
    expect(screen.getByText("保存しました")).toBeInTheDocument();
  });

  it("open が false のとき message は表示されない", () => {
    render(<SavedFlagSnackbar open={false} onClose={() => {}} message="保存しました" />);
    expect(screen.queryByText("保存しました")).not.toBeInTheDocument();
  });

  it("Alert の閉じるボタンをクリックすると onClose が呼ばれる", async () => {
    const onClose = vi.fn();
    render(<SavedFlagSnackbar open onClose={onClose} message="保存しました" />);
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
