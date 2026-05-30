import { describe, expect, it } from "vitest";

import { add } from "./index.js";

describe("@hatchery/common", () => {
  it("add は 2 つの数を加算する", () => {
    expect(add(1, 2)).toBe(3);
  });
});
