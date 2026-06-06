import { afterEach, describe, expect, it } from "vitest";
import type { StorybookConfig } from "@storybook/react-vite";
// main.cts を import する。実ファイル拡張子 .cts を明示して vite の TS 変換を効かせる
// （.cjs を明示すると JS ローダーが選ばれ TS 構文のパースに失敗する）。
import config from "../.storybook/main.cts";

// main.cts の viteFinal が決定する本番 base path を検証する（Issue #166）。
// GitHub Pages はリポジトリ名サブパス（https://itizawa.github.io/hatchery/）で配信されるため、
// 本番ビルドの Vite base は実リポジトリ名 /hatchery/ に一致しなければアセットが 404 になる。

type ViteFinal = NonNullable<StorybookConfig["viteFinal"]>;

// viteFinal を呼び出し、適用後の base を返すヘルパ。
async function resolveBase(
  configType: "PRODUCTION" | "DEVELOPMENT",
): Promise<string | undefined> {
  const viteFinal = config.viteFinal as ViteFinal;
  // options の第 2 引数は configType のみ使用するため最小限を渡す
  const result = await viteFinal(
    {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { configType } as any,
  );
  return result.base;
}

describe("storybook 本番 base path (#166)", () => {
  const original = process.env.STORYBOOK_BASE_PATH;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.STORYBOOK_BASE_PATH;
    } else {
      process.env.STORYBOOK_BASE_PATH = original;
    }
  });

  it("viteFinal が定義されている", () => {
    expect(config.viteFinal).toBeDefined();
  });

  it("(a) PRODUCTION かつ env 未設定なら base は /hatchery/", async () => {
    delete process.env.STORYBOOK_BASE_PATH;
    await expect(resolveBase("PRODUCTION")).resolves.toBe("/hatchery/");
  });

  it("(b) PRODUCTION かつ STORYBOOK_BASE_PATH 設定時はその値で上書きされる", async () => {
    process.env.STORYBOOK_BASE_PATH = "/custom/";
    await expect(resolveBase("PRODUCTION")).resolves.toBe("/custom/");
  });

  it("(c) 非 PRODUCTION では base を変更しない（undefined のまま）", async () => {
    delete process.env.STORYBOOK_BASE_PATH;
    await expect(resolveBase("DEVELOPMENT")).resolves.toBeUndefined();
  });
});
