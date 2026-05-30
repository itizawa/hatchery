import { describe, expect, it } from "vitest";

import { docsTotal } from "./index.js";

describe("@hatchery/docs", () => {
  it("client の total を再利用する (docs → client)", () => {
    expect(docsTotal(4, 5)).toBe(9);
  });
});
