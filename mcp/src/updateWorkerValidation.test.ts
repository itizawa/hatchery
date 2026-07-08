import { describe, expect, it } from "vitest";

import { hasNoUpdateFields } from "./updateWorkerValidation.js";

describe("hasNoUpdateFields (#1032)", () => {
  it("全フィールド未指定なら true を返す", () => {
    expect(
      hasNoUpdateFields({
        displayName: undefined,
        role: undefined,
        personality: undefined,
        verbosity: undefined,
      }),
    ).toBe(true);
  });

  it("displayName のみ指定されていれば false を返す", () => {
    expect(
      hasNoUpdateFields({
        displayName: "新しい名前",
        role: undefined,
        personality: undefined,
        verbosity: undefined,
      }),
    ).toBe(false);
  });

  it("role のみ指定されていれば false を返す", () => {
    expect(
      hasNoUpdateFields({
        displayName: undefined,
        role: "新しい役割",
        personality: undefined,
        verbosity: undefined,
      }),
    ).toBe(false);
  });

  it("personality のみ指定されていれば false を返す", () => {
    expect(
      hasNoUpdateFields({
        displayName: undefined,
        role: undefined,
        personality: "新しい性格",
        verbosity: undefined,
      }),
    ).toBe(false);
  });

  it("verbosity のみ指定されていれば false を返す", () => {
    expect(
      hasNoUpdateFields({
        displayName: undefined,
        role: undefined,
        personality: undefined,
        verbosity: "concise",
      }),
    ).toBe(false);
  });

  it("複数フィールドが指定されていれば false を返す", () => {
    expect(
      hasNoUpdateFields({
        displayName: "新しい名前",
        role: "新しい役割",
        personality: undefined,
        verbosity: undefined,
      }),
    ).toBe(false);
  });
});
