/**
 * WorkerCommunitiesSelect（ワーカーの参加コミュニティ複数選択 Select・#490）の RTL テスト（#531）。
 * 制御コンポーネント（状態は呼び出し元の useForm が保持）のため、`value` を props で固定し
 * `onChange` を spy してコール引数を検証する。MUI Select の開閉・選択は
 * EditWorkerDialog.test.tsx の作法（mouseDown で開き option をクリック）に倣う。
 * 上限は common の WORKER_COMMUNITIES_MAX 定数に依存して検証する（client → common の一方向 import）。
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WORKER_COMMUNITIES_MAX } from "@hatchery/common";

import type { AdminCommunity } from "../api/communities.js";
import { WorkerCommunitiesSelect } from "./WorkerCommunitiesSelect.js";

/** テスト用の AdminCommunity を最小フィールドで組む。 */
// eslint-disable-next-line max-params
function makeCommunity(id: string, name: string, slug = id): AdminCommunity {
  return {
    id,
    slug,
    name,
    description: "説明",
    created_at: new Date("2026-06-01T00:00:00.000Z"),
  };
}

const communities: AdminCommunity[] = [
  makeCommunity("c1", "テック", "tech"),
  makeCommunity("c2", "ライフ", "life"),
  makeCommunity("c3", "ニュース", "news"),
];

/** MUI Select の combobox を取得して開く。 */
function openSelect() {
  fireEvent.mouseDown(screen.getByRole("combobox", { name: /参加コミュニティ/ }));
}

describe("WorkerCommunitiesSelect（#531）", () => {
  it("(a) communities が選択肢として描画される", () => {
    render(
      <WorkerCommunitiesSelect
        communities={communities}
        value={[]}
        onChange={vi.fn()}
        labelId="wc"
      />,
    );
    openSelect();

    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByRole("option", { name: /テック/ })).toBeInTheDocument();
    expect(within(listbox).getByRole("option", { name: /ライフ/ })).toBeInTheDocument();
    expect(within(listbox).getByRole("option", { name: /ニュース/ })).toBeInTheDocument();
  });

  it("(b) 未選択の項目を選ぶと選択後の id 配列で onChange が呼ばれる", () => {
    const onChange = vi.fn();
    render(
      <WorkerCommunitiesSelect
        communities={communities}
        value={[]}
        onChange={onChange}
        labelId="wc"
      />,
    );
    openSelect();
    fireEvent.click(screen.getByRole("option", { name: /テック/ }));

    expect(onChange).toHaveBeenCalledWith(["c1"]);
  });

  it("(c) 既選択の項目を解除すると配列から除かれた id 配列で onChange が呼ばれる", () => {
    const onChange = vi.fn();
    render(
      <WorkerCommunitiesSelect
        communities={communities}
        value={["c1", "c2"]}
        onChange={onChange}
        labelId="wc"
      />,
    );
    openSelect();
    fireEvent.click(screen.getByRole("option", { name: /テック/ }));

    expect(onChange).toHaveBeenCalledWith(["c2"]);
  });

  it("(d) WORKER_COMMUNITIES_MAX 到達後は新規選択しても上限件数に丸められ、余分 id は含まれない", () => {
    // MAX 件すべてを選択済みにし、さらに 1 件余分な選択肢を用意する。
    // eslint-disable-next-line max-params
    const maxSelected = Array.from({ length: WORKER_COMMUNITIES_MAX }, (_, i) =>
      makeCommunity(`c${i}`, `community-${i}`),
    );
    const extra = makeCommunity("extra", "余分コミュニティ");
    const allCommunities = [...maxSelected, extra];
    const selectedIds = maxSelected.map((c) => c.id);
    const onChange = vi.fn();

    render(
      <WorkerCommunitiesSelect
        communities={allCommunities}
        value={selectedIds}
        onChange={onChange}
        labelId="wc"
      />,
    );
    openSelect();
    fireEvent.click(screen.getByRole("option", { name: /余分コミュニティ/ }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const nextIds = onChange.mock.calls[0][0] as string[];
    expect(nextIds).toHaveLength(WORKER_COMMUNITIES_MAX);
    // 上限超過で落ちた余分 id は含まれない。
    expect(nextIds).not.toContain("extra");
  });

  it("(e) disabled のとき combobox が無効でメニューが開かず onChange も呼ばれない", () => {
    const onChange = vi.fn();
    render(
      <WorkerCommunitiesSelect
        communities={communities}
        value={[]}
        onChange={onChange}
        disabled
        labelId="wc"
      />,
    );

    const combobox = screen.getByRole("combobox", { name: /参加コミュニティ/ });
    expect(combobox).toHaveAttribute("aria-disabled", "true");

    fireEvent.mouseDown(combobox);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("(f) 現在値が対応するコミュニティ名のチップとして表示される", () => {
    render(
      <WorkerCommunitiesSelect
        communities={communities}
        value={["c1", "c3"]}
        onChange={vi.fn()}
        labelId="wc"
      />,
    );

    // renderValue が選択中 id を name の Chip で表示する。
    const combobox = screen.getByRole("combobox", { name: /参加コミュニティ/ });
    expect(within(combobox).getByText("テック")).toBeInTheDocument();
    expect(within(combobox).getByText("ニュース")).toBeInTheDocument();
    // 未選択の名前はチップに出ない。
    expect(within(combobox).queryByText("ライフ")).not.toBeInTheDocument();
  });
});
