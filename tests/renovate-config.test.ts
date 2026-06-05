import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const renovatePath = path.join(repoRoot, "renovate.json");

function readRenovate(): Record<string, unknown> {
  const raw = readFileSync(renovatePath, "utf8");
  return JSON.parse(raw) as Record<string, unknown>;
}

describe("renovate.json の存在 (受け入れ条件 #1)", () => {
  it("renovate.json がリポジトリルートに存在する", () => {
    expect(existsSync(renovatePath)).toBe(true);
  });

  it("有効な JSON としてパースできる", () => {
    expect(() => readRenovate()).not.toThrow();
  });
});

describe("ベースブランチ設定 (受け入れ条件 #4)", () => {
  it("baseBranches が develop を含む", () => {
    const config = readRenovate();
    const bases = config.baseBranches as string[];
    expect(Array.isArray(bases)).toBe(true);
    expect(bases).toContain("develop");
  });

  it("baseBranches に main を含まない（main 直の PR を防ぐ）", () => {
    const config = readRenovate();
    const bases = (config.baseBranches ?? []) as string[];
    expect(bases).not.toContain("main");
  });
});

describe("クールダウン設定 (受け入れ条件 #2)", () => {
  it("minimumReleaseAge が定義されている", () => {
    const config = readRenovate();
    expect(config.minimumReleaseAge).toBeDefined();
  });

  it("minimumReleaseAge が 7 days のクールダウンを設定している", () => {
    const config = readRenovate();
    const age = config.minimumReleaseAge as string;
    expect(age).toMatch(/7\s+days?/);
  });
});

describe("スケジュール設定 (受け入れ条件 #1)", () => {
  it("schedule が定義されている（定期的に PR を生成する）", () => {
    const config = readRenovate();
    expect(config.schedule).toBeDefined();
    const schedule = config.schedule as string[];
    expect(Array.isArray(schedule)).toBe(true);
    expect(schedule.length).toBeGreaterThan(0);
  });
});

describe("セキュリティ例外設定 (受け入れ条件 #3)", () => {
  it("vulnerabilityAlerts が定義されている（重大セキュリティ修正の例外ポリシー）", () => {
    const config = readRenovate();
    expect(config.vulnerabilityAlerts).toBeDefined();
  });

  it("vulnerabilityAlerts の minimumReleaseAge は 0 days（CVE 修正は即時適用）", () => {
    const config = readRenovate();
    const vulnAlerts = config.vulnerabilityAlerts as Record<string, unknown>;
    const age = vulnAlerts?.minimumReleaseAge as string | undefined;
    expect(age).toMatch(/^0\s+days?$/);
  });
});
