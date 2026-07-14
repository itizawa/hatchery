import { describe, expect, it } from "vitest";

import { parseSearchQueryParam } from "./searchQueryParam";

describe("parseSearchQueryParam", () => {
  it("q が未指定のとき {} を返す", () => {
    expect(parseSearchQueryParam({})).toEqual({});
  });

  it("q が非文字列（数値）のとき {} を返す", () => {
    expect(parseSearchQueryParam({ q: 123 })).toEqual({});
  });

  it("q が空文字のとき {} を返す", () => {
    expect(parseSearchQueryParam({ q: "" })).toEqual({});
  });

  it("q が空白のみのとき {} を返す", () => {
    expect(parseSearchQueryParam({ q: "   " })).toEqual({});
  });

  it("q が前後空白付き文字列のとき trim された値で { q } を返す", () => {
    expect(parseSearchQueryParam({ q: "  hello  " })).toEqual({ q: "hello" });
  });
});
