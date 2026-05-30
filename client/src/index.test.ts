import { describe, expect, it } from "vitest";

import { total } from "./index.js";

describe("@hatchery/client", () => {
  it("common の add を再利用して合計する (client → common)", () => {
    expect(total(4, 5)).toBe(9);
  });
});
