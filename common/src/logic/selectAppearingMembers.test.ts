import { describe, expect, it } from "vitest";

import type { Employee } from "../domain/employee/index.js";
import { selectAppearingMembers } from "./selectAppearingMembers.js";

const emp = (id: string): Employee => ({ id, displayName: id });

const employees: Employee[] = [emp("haru"), emp("ken"), emp("mei")];

describe("selectAppearingMembers (B-2)", () => {
  it("最終登場が古い社員を優先して最大 count 名の id を返す", () => {
    // haru=定時5(最新), ken=定時1(最古), mei=定時3
    const lastAppearedBySlot = { haru: 5, ken: 1, mei: 3 };
    expect(selectAppearingMembers(employees, 2, lastAppearedBySlot)).toEqual(["ken", "mei"]);
  });

  it("未登場（エントリ無し）の社員を最優先で選ぶ", () => {
    // ken のみ未登場 → 最優先
    const lastAppearedBySlot = { haru: 2, mei: 4 };
    expect(selectAppearingMembers(employees, 1, lastAppearedBySlot)).toEqual(["ken"]);
  });

  it("候補数が count 以下なら全員返す", () => {
    expect(selectAppearingMembers(employees, 5, {})).toHaveLength(3);
  });

  it("count = 0 なら空配列を返す", () => {
    expect(selectAppearingMembers(employees, 0, { haru: 1 })).toEqual([]);
  });

  it("同入力で結果が決定的（同点は入力順で安定）", () => {
    const slot = { haru: 2, ken: 2, mei: 2 };
    const a = selectAppearingMembers(employees, 2, slot);
    const b = selectAppearingMembers(employees, 2, slot);
    expect(a).toEqual(b);
    expect(a).toEqual(["haru", "ken"]);
  });

  it("入力（employees / lastAppearedBySlot）を破壊しない", () => {
    const empInput = [...employees];
    const slotInput = { haru: 5, ken: 1, mei: 3 };
    const slotCopy = { ...slotInput };
    selectAppearingMembers(empInput, 2, slotInput);
    expect(empInput).toEqual(employees);
    expect(slotInput).toEqual(slotCopy);
  });
});
