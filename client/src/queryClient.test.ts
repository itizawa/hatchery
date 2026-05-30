import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { createQueryClient } from "./queryClient";

// 受け入れ条件 #3: TanStack Query の QueryClient（サーバ状態を集約する土台）。
describe("createQueryClient", () => {
  it("QueryClient インスタンスを返す", () => {
    expect(createQueryClient()).toBeInstanceOf(QueryClient);
  });

  it("既定の retry が 1 に設定される", () => {
    const client = createQueryClient();
    expect(client.getDefaultOptions().queries?.retry).toBe(1);
  });

  it("呼び出すたびに独立したインスタンスを返す", () => {
    expect(createQueryClient()).not.toBe(createQueryClient());
  });
});
