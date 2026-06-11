import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Issue #393: Playwright e2e テスト基盤の規約テスト。
 *
 * - ルート playwright.config.ts が testDir './e2e' で全サブディレクトリを収集する
 * - e2e/ 以下の各機能エリアに usecases.md と {area}.spec.ts が存在する
 * - usecases.md の `## UC-...` 見出しと spec の test.todo("...") が 1:1 で対応する
 * - ルート package.json に e2e スクリプトと @playwright/test devDependency がある
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const e2eDir = path.join(repoRoot, "e2e");

const AREAS = ["auth", "home-feed", "community", "post-thread", "admin"] as const;

function readUsecases(area: string): string {
  return readFileSync(path.join(e2eDir, area, "usecases.md"), "utf8");
}

function readSpec(area: string): string {
  return readFileSync(path.join(e2eDir, area, `${area}.spec.ts`), "utf8");
}

function usecaseTitles(md: string): string[] {
  return [...md.matchAll(/^## (UC-[A-Z]+-\d+: .+)$/gm)].map((m) => m[1].trim());
}

function todoTitles(spec: string): string[] {
  return [...spec.matchAll(/test\.todo\(\s*"([^"]+)"\s*\)/g)].map((m) => m[1].trim());
}

describe("playwright.config.ts (受け入れ条件 1)", () => {
  it("リポジトリルートに存在する", () => {
    expect(existsSync(path.join(repoRoot, "playwright.config.ts"))).toBe(true);
  });

  it("testDir './e2e' で全サブディレクトリの spec を収集する", () => {
    const config = readFileSync(path.join(repoRoot, "playwright.config.ts"), "utf8");
    expect(config).toMatch(/testDir:\s*["']\.\/e2e["']/);
  });

  it("CI 除外の理由がコメントで明示されている (受け入れ条件 7)", () => {
    const config = readFileSync(path.join(repoRoot, "playwright.config.ts"), "utf8");
    expect(config).toMatch(/CI/);
  });
});

describe("e2e 機能エリアのディレクトリ構成 (受け入れ条件 2)", () => {
  it.each(AREAS)("e2e/%s/ が存在する", (area) => {
    expect(existsSync(path.join(e2eDir, area))).toBe(true);
  });
});

describe.each(AREAS)("e2e/%s の usecases.md (受け入れ条件 3)", (area) => {
  it("usecases.md が存在する", () => {
    expect(existsSync(path.join(e2eDir, area, "usecases.md"))).toBe(true);
  });

  it("`## UC-...` 形式のユースケース見出しを 1 件以上持つ", () => {
    expect(usecaseTitles(readUsecases(area)).length).toBeGreaterThan(0);
  });

  it("前提条件・ステップ・期待動作のセクションを含む", () => {
    const md = readUsecases(area);
    expect(md).toMatch(/前提条件/);
    expect(md).toMatch(/ステップ/);
    expect(md).toMatch(/期待動作/);
  });

  it("ユースケース ID が重複しない", () => {
    const titles = usecaseTitles(readUsecases(area));
    expect(new Set(titles).size).toBe(titles.length);
  });
});

describe.each(AREAS)("e2e/%s の spec スケルトン (受け入れ条件 4)", (area) => {
  it(`${area}.spec.ts が存在する`, () => {
    expect(existsSync(path.join(e2eDir, area, `${area}.spec.ts`))).toBe(true);
  });

  it("test.todo() のタイトルが usecases.md の見出しと 1:1 で完全一致する", () => {
    const expected = usecaseTitles(readUsecases(area));
    const actual = todoTitles(readSpec(area));
    expect(actual).toEqual(expected);
  });
});

describe("ルート package.json (受け入れ条件 5・6)", () => {
  const pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  it("e2e スクリプトで playwright test を実行できる", () => {
    expect(pkg.scripts?.e2e).toMatch(/playwright test/);
  });

  it("@playwright/test が devDependencies にある", () => {
    expect(pkg.devDependencies?.["@playwright/test"]).toBeDefined();
  });
});
