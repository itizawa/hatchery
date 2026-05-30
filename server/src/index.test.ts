import { describe, expect, it } from "vitest";

import { sum } from "./index.js";

describe("@hatchery/server", () => {
  it("common の add を再利用して合計する (server → common)", () => {
    expect(sum(2, 3)).toBe(5);
  });
});
