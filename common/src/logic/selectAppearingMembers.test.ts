import { describe, expect, it } from "vitest";

import type { Worker } from "../domain/worker/index.js";
import { selectAppearingMembers } from "./selectAppearingMembers.js";

const wrk = (id: string): Worker => ({ id, displayName: id });

const workers: Worker[] = [wrk("haru"), wrk("ken"), wrk("mei")];

describe("selectAppearingMembers (B-2)", () => {
  it("最終登場が古いワーカーを優先して最大 count 名の id を返す", () => {
    // haru=定時5(最新), ken=定時1(最古), mei=定時3
    const lastAppearedBySlot = { haru: 5, ken: 1, mei: 3 };
    expect(selectAppearingMembers({ workers, count: 2, lastAppearedBySlot })).toEqual(["ken", "mei"]);
  });

  it("未登場（エントリ無し）のワーカーを最優先で選ぶ", () => {
    // ken のみ未登場 → 最優先
    const lastAppearedBySlot = { haru: 2, mei: 4 };
    expect(selectAppearingMembers({ workers, count: 1, lastAppearedBySlot })).toEqual(["ken"]);
  });

  it("候補数が count 以下なら全員返す", () => {
    expect(selectAppearingMembers({ workers, count: 5, lastAppearedBySlot: {} })).toHaveLength(3);
  });

  it("count = 0 なら空配列を返す", () => {
    expect(selectAppearingMembers({ workers, count: 0, lastAppearedBySlot: { haru: 1 } })).toEqual([]);
  });

  it("同入力で結果が決定的（同点は入力順で安定）", () => {
    const slot = { haru: 2, ken: 2, mei: 2 };
    const a = selectAppearingMembers({ workers, count: 2, lastAppearedBySlot: slot });
    const b = selectAppearingMembers({ workers, count: 2, lastAppearedBySlot: slot });
    expect(a).toEqual(b);
    expect(a).toEqual(["haru", "ken"]);
  });

  it("入力（workers / lastAppearedBySlot）を破壊しない", () => {
    const wrkInput = [...workers];
    const slotInput = { haru: 5, ken: 1, mei: 3 };
    const slotCopy = { ...slotInput };
    selectAppearingMembers({ workers: wrkInput, count: 2, lastAppearedBySlot: slotInput });
    expect(wrkInput).toEqual(workers);
    expect(slotInput).toEqual(slotCopy);
  });
});
