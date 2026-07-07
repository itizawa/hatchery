/**
 * CommunityWorkersSelect（コミュニティの所属ワーカー複数選択 Select・#1079）の RTL テスト。
 * 制御コンポーネント（状態は呼び出し元の useForm が保持）のため、`value` を props で固定し
 * `onChange` を spy してコール引数を検証する。`WorkerCommunitiesSelect.test.tsx`（#531）と対称。
 * 上限は common の COMMUNITY_WORKERS_MAX 定数に依存して検証する（client → common の一方向 import）。
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { COMMUNITY_WORKERS_MAX } from "@hatchery/common";
import type { Worker } from "@hatchery/common";

import { CommunityWorkersSelect } from "./CommunityWorkersSelect.js";

/** テスト用の Worker を最小フィールドで組む。 */
// eslint-disable-next-line max-params
function makeWorker(id: string, displayName: string): Worker {
  return { id, displayName };
}

const workers: Worker[] = [
  makeWorker("w1", "haru"),
  makeWorker("w2", "ken"),
  makeWorker("w3", "mei"),
];

/** MUI Select の combobox を取得して開く。 */
function openSelect() {
  fireEvent.mouseDown(screen.getByRole("combobox", { name: /所属ワーカー/ }));
}

describe("CommunityWorkersSelect（#1079）", () => {
  it("(a) workers が選択肢として描画される", () => {
    render(
      <CommunityWorkersSelect workers={workers} value={[]} onChange={vi.fn()} labelId="cw" />,
    );
    openSelect();

    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByRole("option", { name: /haru/ })).toBeInTheDocument();
    expect(within(listbox).getByRole("option", { name: /ken/ })).toBeInTheDocument();
    expect(within(listbox).getByRole("option", { name: /mei/ })).toBeInTheDocument();
  });

  it("(b) 未選択の項目を選ぶと選択後の id 配列で onChange が呼ばれる", () => {
    const onChange = vi.fn();
    render(
      <CommunityWorkersSelect workers={workers} value={[]} onChange={onChange} labelId="cw" />,
    );
    openSelect();
    fireEvent.click(screen.getByRole("option", { name: /haru/ }));

    expect(onChange).toHaveBeenCalledWith(["w1"]);
  });

  it("(c) 既選択の項目を解除すると配列から除かれた id 配列で onChange が呼ばれる", () => {
    const onChange = vi.fn();
    render(
      <CommunityWorkersSelect
        workers={workers}
        value={["w1", "w2"]}
        onChange={onChange}
        labelId="cw"
      />,
    );
    openSelect();
    fireEvent.click(screen.getByRole("option", { name: /haru/ }));

    expect(onChange).toHaveBeenCalledWith(["w2"]);
  });

  it("(d) COMMUNITY_WORKERS_MAX 到達後は新規選択しても上限件数に丸められ、余分 id は含まれない", () => {
    // eslint-disable-next-line max-params
    const maxSelected = Array.from({ length: COMMUNITY_WORKERS_MAX }, (_, i) =>
      makeWorker(`w${i}`, `worker-${i}`),
    );
    const extra = makeWorker("extra", "余分ワーカー");
    const allWorkers = [...maxSelected, extra];
    const selectedIds = maxSelected.map((w) => w.id);
    const onChange = vi.fn();

    render(
      <CommunityWorkersSelect
        workers={allWorkers}
        value={selectedIds}
        onChange={onChange}
        labelId="cw"
      />,
    );
    openSelect();
    fireEvent.click(screen.getByRole("option", { name: /余分ワーカー/ }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const nextIds = onChange.mock.calls[0][0] as string[];
    expect(nextIds).toHaveLength(COMMUNITY_WORKERS_MAX);
    expect(nextIds).not.toContain("extra");
  });

  it("(e) disabled のとき combobox が無効でメニューが開かず onChange も呼ばれない", () => {
    const onChange = vi.fn();
    render(
      <CommunityWorkersSelect
        workers={workers}
        value={[]}
        onChange={onChange}
        disabled
        labelId="cw"
      />,
    );

    const combobox = screen.getByRole("combobox", { name: /所属ワーカー/ });
    expect(combobox).toHaveAttribute("aria-disabled", "true");

    fireEvent.mouseDown(combobox);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("(f) 現在値が対応するワーカー名のチップとして表示される", () => {
    render(
      <CommunityWorkersSelect
        workers={workers}
        value={["w1", "w3"]}
        onChange={vi.fn()}
        labelId="cw"
      />,
    );

    const combobox = screen.getByRole("combobox", { name: /所属ワーカー/ });
    expect(within(combobox).getByText("haru")).toBeInTheDocument();
    expect(within(combobox).getByText("mei")).toBeInTheDocument();
    expect(within(combobox).queryByText("ken")).not.toBeInTheDocument();
  });
});
